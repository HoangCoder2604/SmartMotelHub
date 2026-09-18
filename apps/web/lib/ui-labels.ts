const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Bản nháp",
  ACTIVE: "Đang hiệu lực",
  INACTIVE: "Tạm ngừng",
  EXPIRED: "Đã hết hạn",
  TERMINATED: "Đã kết thúc",
  PENDING: "Đang chờ",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
  HIDDEN: "Đang ẩn",
  UNPAID: "Chưa thanh toán",
  PAID: "Đã thanh toán",
  OVERDUE: "Quá hạn",
  SUCCEEDED: "Thành công",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
  CONFIRMED: "Đã xác nhận",
  COMPLETED: "Hoàn tất",
  NO_SHOW: "Không đến",
  OPEN: "Mới",
  INVESTIGATING: "Đang xử lý",
  RESOLVED: "Đã giải quyết",
  LOCKED: "Đã khóa",
};

const ROLE_LABELS: Record<string, string> = {
  TENANT: "Khách thuê",
  LANDLORD: "Chủ nhà",
  ADMIN: "Quản trị viên",
};

export function statusLabel(value: string | null | undefined) {
  if (!value) return "—";
  return STATUS_LABELS[value] ?? value;
}

export function roleLabel(value: string | null | undefined) {
  if (!value) return "—";
  return ROLE_LABELS[value] ?? value;
}
