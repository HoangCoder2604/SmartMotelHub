export default function Loading() {
  return (
    <main className="route-skeleton-page" aria-busy="true" aria-label="Đang tải nội dung">
      <div className="route-skeleton-shell">
        <div className="skeleton skeleton-line skeleton-brand" />
        <div className="skeleton skeleton-line skeleton-title" />
        <div className="skeleton skeleton-line skeleton-subtitle" />
        <div className="route-skeleton-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="skeleton skeleton-card" key={index} />
          ))}
        </div>
      </div>
    </main>
  );
}
