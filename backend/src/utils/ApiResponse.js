class ApiResponse {
  static success(res, data = null, message = "Success", statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      data,
      message,
    });
  }
}

module.exports = ApiResponse;