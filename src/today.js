// 今日のローカル日付（YYYY-MM-DD）。toISOString はUTCでずれるため使わない。純関数には、画面からこの値を渡す。
export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
