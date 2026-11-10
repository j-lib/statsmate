// routes/analyzeRoute.js - Main orchestration endpoint
// Reads the uploaded CSV, runs the regression in the R service for the chosen
// model, then asks the AI gateway for a plain-language interpretation (falling
// back to a deterministic template if the gateway is unavailable).
import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import limiter, { QueueFullError } from '../limiter.js';
import { templateInterpretation, aiInterpretationToMarkdown } from '../interpretation.js';

const router = express.Router();

const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || 'http://ai-gateway:8001';
const R_OLS_URL = process.env.R_OLS_URL || 'http://r-ols:8000';
const R_LOGISTIC_URL = process.env.R_LOGISTIC_URL || 'http://r-logistic:8002';
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/uploads';
const ANALYSIS_TIMEOUT = Number(process.env.ANALYSIS_TIMEOUT) || 45000;
const AI_TIMEOUT = Number(process.env.AI_TIMEOUT) || 20000;

// Parse CSV text into an array of row objects. Handles quoted fields
// (including commas and newlines inside quotes) and converts numeric strings.
export function parseCSV(csvString) {
  return parse(csvString, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    cast: (value) => {
      if (value === '') return null;
      const num = Number(value);
      return Number.isFinite(num) ? num : value;
    },
  });
}

// Only files inside the uploads directory may be read
function resolveUploadPath(dataPath) {
  const filename = path.basename(String(dataPath));
  const candidates = [path.join(UPLOADS_DIR, filename), path.join('./uploads', filename)];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

async function getInterpretation({ modelType, rData, dependentVar }) {
  const context = {
    modelType,
    tidy: rData.tidy || [],
    glance: rData.glance || {},
    dependentVar,
    successLevel: Array.isArray(rData.outcome_success_level) ? rData.outcome_success_level[0] : rData.outcome_success_level,
    warning: Array.isArray(rData.warning) ? rData.warning[0] : rData.warning,
  };

  try {
    const ai = await axios.post(
      `${AI_GATEWAY_URL}/interpret`,
      { model_type: modelType, formula: [].concat(rData.formula)[0], results: { tidy: context.tidy, glance: context.glance } },
      { timeout: AI_TIMEOUT }
    );
    if (ai.data?.ok) {
      return { text: aiInterpretationToMarkdown(ai.data, { warning: context.warning }), source: 'ai' };
    }
  } catch (error) {
    const reason = error.response?.data?.error || error.code || error.message;
    console.log(`   AI gateway unavailable (${reason}); using template interpretation`);
  }
  return { text: templateInterpretation(context), source: 'template' };
}

router.post('/analyze', async (req, res) => {
  const { userId, fileId, data_path, dependentVar, independentVars, modelType } = req.body;

  if (!data_path || !dependentVar || !Array.isArray(independentVars) || independentVars.length === 0) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['data_path', 'dependentVar', 'independentVars'],
    });
  }

  const jobId = `job-${Date.now()}-${userId || 'anonymous'}`;
  const model = modelType === 'logistic' ? 'logistic' : 'ols'; // 'auto' defaults to OLS
  const startTime = Date.now();
  console.log(`🔄 ${jobId}: ${model} ${dependentVar} ~ ${independentVars.join(' + ')}`);

  try {
    const result = await limiter.run(jobId, async () => {
      const filePath = resolveUploadPath(data_path);
      if (!filePath) {
        const err = new Error(`Cannot find file: ${path.basename(String(data_path))}`);
        err.status = 400;
        err.code = 'FILE_NOT_FOUND';
        throw err;
      }

      const inlineData = parseCSV(fs.readFileSync(filePath, 'utf8'));
      const serviceUrl = model === 'logistic' ? R_LOGISTIC_URL : R_OLS_URL;

      const rResponse = await axios.post(
        `${serviceUrl}/${model}`,
        { data: inlineData, dependent_var: dependentVar, independent_vars: independentVars },
        { timeout: ANALYSIS_TIMEOUT }
      );
      const rData = rResponse.data;
      if (rData.error) throw new Error(`${rData.error}${rData.message ? ': ' + rData.message : ''}`);

      const interpretation = await getInterpretation({ modelType: model, rData, dependentVar });
      return { rData, interpretation, serviceUrl };
    });

    const { rData, interpretation, serviceUrl } = result;
    const processingTime = Number(((Date.now() - startTime) / 1000).toFixed(2));
    console.log(`✅ ${jobId} complete in ${processingTime}s (interpretation: ${interpretation.source})`);

    return res.status(200).json({
      status: 'complete',
      jobId,
      modelType: model,
      results: {
        tidy: rData.tidy || [],
        glance: rData.glance || {},
        diagnostics: rData.diagnostics || null,
        r_code: rData.r_code || '',
        warning: rData.warning || null,
      },
      interpretation: interpretation.text,
      interpretationSource: interpretation.source,
      processingTime,
      rService: serviceUrl,
    });
  } catch (error) {
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`❌ ${jobId} failed after ${processingTime}s:`, error.message);

    if (error instanceof QueueFullError) {
      return res.status(429).json({ error: 'Queue full', message: 'Too many requests. Please try again shortly.', retryAfter: 10 });
    }
    if (error.code === 'FILE_NOT_FOUND') {
      return res.status(400).json({ error: 'FILE_NOT_FOUND', message: error.message });
    }
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'Service unavailable', message: 'Cannot connect to the R analysis service.' });
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Analysis timeout', message: 'Analysis took too long. Try a smaller dataset.' });
    }
    if (error.response) {
      return res.status(error.response.status || 500).json({
        error: 'Analysis error',
        message: [].concat(error.response.data?.error || error.response.data?.message || 'Analysis failed')[0],
        details: error.response.data,
      });
    }
    return res.status(500).json({ error: 'Analysis failed', message: error.message, jobId });
  }
});

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'integration-api',
    limiter: limiter.getStatus(),
    services: { rOls: R_OLS_URL, rLogistic: R_LOGISTIC_URL, aiGateway: AI_GATEWAY_URL },
    timestamp: new Date().toISOString(),
  });
});

router.get('/queue-status', (req, res) => {
  res.json({ limiter: limiter.getStatus() });
});

export default router;
