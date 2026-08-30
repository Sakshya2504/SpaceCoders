// Keep success responses consistent across route handlers.
export function ok(
  res,
  data = null,
  message = 'OK',
  status = 200
) {
  return res.status(status).json({
    success: true,
    data,
    message,
    error: null
  });
}

// Keep validation and application errors consistent as well.
export function fail(
  res,
  message,
  code = 'BAD_REQUEST',
  details = null,
  status = 400
) {
  return res.status(status).json({
    success: false,
    data: null,
    message,
    error: {
      code,
      details
    }
  });
}
