import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type RemainingItem = { name: string; note?: string };

type RemainingCardProps = {
  chinese: RemainingItem[];
  english: RemainingItem[];
  homework: { name: string; missing: string[] }[];
};

/** Data Widget — lists from DashboardService only */
export function RemainingCard({
  chinese,
  english,
  homework,
}: RemainingCardProps) {
  return (
    <Card>
      <CardTitle>未完成</CardTitle>
      <CardDescription>依目前週／今日作業（僅已完成不算未完成）</CardDescription>
      <div className="mt-4 space-y-4 text-sm">
        <RemainingBlock title="國語" items={chinese} />
        <RemainingBlock title="英語" items={english} />
        <div>
          <p className="font-medium text-gray-800">作業</p>
          {homework.length === 0 ? (
            <p className="mt-1 text-gray-400">全部交齊／尚未建立</p>
          ) : (
            <ul className="mt-1 space-y-1 text-gray-700">
              {homework.map((item) => (
                <li key={`${item.name}-${item.missing.join(",")}`}>
                  {item.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

function RemainingBlock({
  title,
  items,
}: {
  title: string;
  items: RemainingItem[];
}) {
  return (
    <div>
      <p className="font-medium text-gray-800">{title}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-gray-400">全部完成</p>
      ) : (
        <ul className="mt-1 space-y-1 text-gray-700">
          {items.map((item) => (
            <li key={`${title}-${item.name}`}>
              {item.name}
              {item.note ? (
                <span className="ml-1 text-red-600">（{item.note}）</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
