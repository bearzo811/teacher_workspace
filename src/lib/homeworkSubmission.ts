/** 收件與批改是不同進度：待確認、待訂正也都已經交件。 */
export function unsubmittedTitles(cells: readonly { status: string; title: string }[]) {
  return cells.filter((cell) => cell.status === "unsubmitted").map((cell) => cell.title);
}
