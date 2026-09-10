export function humanizeAuthError(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error);
  const codeMatch = value.match(/auth\/([a-z-]+)/i);
  const code = codeMatch?.[1];

  const messages: Record<string, string> = {
    "invalid-credential": "Email hoặc mật khẩu không đúng.",
    "email-already-in-use": "Email này đã được sử dụng.",
    "weak-password": "Mật khẩu chưa đủ mạnh. Hãy dùng ít nhất 6 ký tự.",
    "invalid-email": "Địa chỉ email không hợp lệ.",
    "popup-closed-by-user": "Bạn đã đóng cửa sổ đăng nhập Google.",
    "popup-blocked": "Trình duyệt đang chặn popup đăng nhập Google.",
    "too-many-requests": "Có quá nhiều yêu cầu. Hãy thử lại sau.",
    "unauthorized-continue-uri": "Domain chuyển hướng chưa được Firebase cho phép. Hãy thêm localhost vào Authentication > Settings > Authorized domains.",
    "invalid-continue-uri": "Địa chỉ quay lại sau xác minh email không hợp lệ.",
    "invalid-phone-number": "Số điện thoại không hợp lệ. Hãy dùng định dạng +84...",
    "invalid-verification-code": "Mã OTP không đúng.",
    "code-expired": "Mã OTP đã hết hạn. Hãy gửi lại mã mới.",
  };

  return (code && messages[code]) || value;
}
