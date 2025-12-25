const { config } = require('../config/env');

function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  const response = {
    success: false,
    message: message
  };

  if (config.env === 'development') {
    response.stack = err.stack;
    response.error = err;
  }

  res.status(statusCode).json(response);
}

function notFound(req, res, next) {
  const error = new Error(`Not found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFound,
  asyncHandler
};
