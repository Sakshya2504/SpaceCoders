// Return a consistent 404 response when no route matches the request.
export function notFound(req, res) {
  return res.status(404).json({
    success: false,
    data: null,
    message: 'Route not found',
    error: {
      code: 'NOT_FOUND'
    }
  });
}

// Keep server errors in one place so every API response follows the same shape.
export function errorHandler(err, req, res, next) {
  console.error(err);

  const status = err.status || 500;
  const isKnownError = Boolean(err.status);

  return res.status(status).json({
    success: false,
    data: null,
    message: isKnownError ? err.message : 'Internal server error',
    error: {
      code: err.code || 'INTERNAL_ERROR'
    }
  });
}
