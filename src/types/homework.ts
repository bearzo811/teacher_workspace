/** 顯示用：簿本 + 頁數／課次 */
export function formatHomeworkTitle(bookName: string, pageLabel: string) {
  const book = bookName.trim();
  const page = pageLabel.trim();
  if (!book) return page;
  if (!page) return book;
  return `${book} ${page}`;
}

export function assignmentKey(bookId: string, pageLabel: string) {
  return `${bookId}::${pageLabel.trim()}`;
}

export type HomeworkAssignmentInput = {
  bookId: string;
  pageLabel: string;
};
