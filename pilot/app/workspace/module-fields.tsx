import { modules } from "../../lib/modules";

export function ModuleFields({ selected = [] }: { selected?: readonly string[] }) {
  return <fieldset style={{ margin: "20px 0", padding: 16 }}>
    <legend>選擇班級需要的功能</legend>
    <p>班級、學生名冊、學期與行事曆固定保留。其他功能可不選，之後隨時調整。</p>
    {modules.map(module => <label key={module.id} style={{ display: "block", marginBottom: 12 }}>
      <input type="checkbox" name="modules" value={module.id} defaultChecked={selected.includes(module.id)} /> {module.name}
      <span style={{ display: "block", marginLeft: 24, color: "#475569" }}>{module.description}</span>
    </label>)}
    <p>關閉不刪資料；相關獎勵及欠繳限制也應停用。大屏顯示設定將另外管理。</p>
    <p>目前僅開放班級與名冊；勾選會保存使用偏好，其餘模組仍在開發，尚不能操作。</p>
  </fieldset>;
}
