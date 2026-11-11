"use client";

import Link from "next/link";
import type { getStudentDebtChecklist } from "@/services/debtChecklistService";
import styles from "./DebtChecklistPrint.module.css";

type Checklist = NonNullable<Awaited<ReturnType<typeof getStudentDebtChecklist>>>;

export function DebtChecklistPrint({ data, studentId }: { data: Checklist; studentId: string }) {
  return (
    <main className={styles.page}>
      <div className={styles.toolbar}>
        <Link href={`/students/${studentId}`}>← 回學生頁</Link>
        <p>清單寬 13 公分，列印後可剪下貼在聯絡簿。列印視窗也可選「另存為 PDF」。</p>
        <button type="button" onClick={() => window.print()}>列印／另存 PDF</button>
      </div>
      <article className={styles.slip}>
        <h1>作業與護照自主檢核表</h1>
        <div className={styles.identity}>
          <strong>{data.className}　{data.seatNumber} 號 {data.name}</strong>
          <span>截至 {data.asOfDate.replaceAll("-", "/")} · 共 {data.items.length} 項</span>
        </div>
        {data.items.length === 0 ? <p className={styles.empty}>目前沒有欠繳項目。</p> : (
          <table>
            <colgroup><col className={styles.checkColumn} /><col className={styles.dateColumn} /><col /><col className={styles.statusColumn} /></colgroup>
            <thead><tr><th scope="col">完成</th><th scope="col">聯絡簿日期</th><th scope="col">待完成項目</th><th scope="col">狀態</th></tr></thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.key}>
                  <td><span className={styles.checkbox} aria-label="完成勾選格" /></td>
                  <td>{item.contactBookDate ? item.contactBookDate.slice(5).replace("-", "/") : "—"}</td>
                  <td className={styles.item}>{item.label}{item.note && <span className={styles.note}>（{item.note}）</span>}</td>
                  <td>{item.status === "correction_required" ? "需訂正" : item.category === "作業" ? "未交" : "未完成"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </main>
  );
}
