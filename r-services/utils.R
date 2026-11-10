# utils.R - Shared helpers for the R regression services
#
# Security notes:
# * R evaluates function calls inside model formulas (e.g. `y ~ system("...")`),
#   so user-supplied formulas and column names must never be passed straight to
#   as.formula(). build_formula() only accepts plain column names that exist in the
#   data, and check_formula() only allows a small set of formula operators.
# * data_path is restricted to files inside UPLOADS_DIR so the services cannot be
#   used to read arbitrary files from the container.

UPLOADS_DIR <- Sys.getenv("UPLOADS_DIR", "/uploads")

# Operators allowed in a user-supplied formula string
ALLOWED_FORMULA_OPS <- c("~", "+", ":", "*", "(", "-")

# Load data from inline JSON rows or from a file inside UPLOADS_DIR.
# Returns a data.frame, or stops with a user-facing message.
load_data <- function(inline_data = NULL, data_path = NULL) {
  if (!is.null(inline_data) && length(inline_data) > 0) {
    if (!is.list(inline_data)) stop("'data' must be an array of row objects")
    df <- do.call(rbind, lapply(inline_data, function(row) {
      row[vapply(row, is.null, logical(1))] <- NA
      as.data.frame(row, stringsAsFactors = FALSE, check.names = FALSE)
    }))
    # Convert character columns that are entirely numeric (ignoring blanks/NA)
    for (col in names(df)) {
      if (is.character(df[[col]])) {
        vals <- df[[col]]
        present <- !is.na(vals) & nzchar(trimws(vals))
        num <- suppressWarnings(as.numeric(vals))
        if (any(present) && all(!is.na(num[present]))) df[[col]] <- num
      }
    }
    return(df)
  }

  if (!is.null(data_path)) {
    # Only the file name is honoured; the directory is always UPLOADS_DIR
    path <- file.path(UPLOADS_DIR, basename(data_path))
    if (!file.exists(path)) stop("Data file not found: ", basename(data_path))
    if (grepl("\\.csv$", path, ignore.case = TRUE)) {
      return(utils::read.csv(path, stringsAsFactors = FALSE, check.names = FALSE))
    }
    if (grepl("\\.xlsx?$", path, ignore.case = TRUE)) {
      if (!requireNamespace("readxl", quietly = TRUE)) stop("readxl package not available")
      return(as.data.frame(readxl::read_excel(path)))
    }
    stop("Unsupported file format (use .csv or .xlsx)")
  }

  stop("No data provided")
}

# Wrap a column name in backticks so names with spaces or symbols are treated
# as names, never as code.
quote_name <- function(x) paste0("`", gsub("`", "", x, fixed = TRUE), "`")

# Build a formula from validated column names.
build_formula <- function(dependent_var, independent_vars, data) {
  dependent_var <- as.character(unlist(dependent_var))
  independent_vars <- as.character(unlist(independent_vars))
  if (length(dependent_var) != 1 || !nzchar(dependent_var)) stop("Provide exactly one dependent variable")
  if (length(independent_vars) == 0) stop("Provide at least one independent variable")

  missing <- setdiff(c(dependent_var, independent_vars), names(data))
  if (length(missing) > 0) {
    stop("Variables not found in data: ", paste(missing, collapse = ", "))
  }
  if (dependent_var %in% independent_vars) stop("The dependent variable cannot also be a predictor")

  stats::reformulate(
    termlabels = vapply(independent_vars, quote_name, character(1)),
    response = as.name(dependent_var)
  )
}

# Validate a user-supplied formula string: only known operators and column names.
check_formula <- function(formula_str, data) {
  f <- tryCatch(stats::as.formula(formula_str), error = function(e) stop("Invalid formula"))
  if (length(f) != 3) stop("Formula must have the form outcome ~ predictors")
  vars <- all.vars(f)
  ops <- setdiff(all.names(f), vars)
  bad_ops <- setdiff(ops, ALLOWED_FORMULA_OPS)
  if (length(bad_ops) > 0) {
    stop("Formula contains unsupported terms: ", paste(bad_ops, collapse = ", "))
  }
  missing <- setdiff(vars, names(data))
  if (length(missing) > 0) stop("Variables not found in data: ", paste(missing, collapse = ", "))
  f
}

# Choose between an explicit formula string and dependent/independent variables.
resolve_formula <- function(body, data) {
  # [[ ]] (exact matching), not $ (which partially matches list names)
  if (!is.null(body[["formula"]])) return(check_formula(body[["formula"]], data))
  if (!is.null(body[["dependent_var"]]) && !is.null(body[["independent_vars"]])) {
    return(build_formula(body[["dependent_var"]], body[["independent_vars"]], data))
  }
  stop("Provide either 'formula' or 'dependent_var' + 'independent_vars'")
}

formula_text <- function(f) paste(deparse(f, width.cutoff = 500L), collapse = " ")
