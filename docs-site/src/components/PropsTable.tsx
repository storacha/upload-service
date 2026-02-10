type PropRow = {
  name: string
  type: string
  default?: string
  description: string
}

export function PropsTable({ rows }: { rows: PropRow[] }) {
  return (
    <div className="not-prose overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-md">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
          <tr>
            <th className="px-4 py-2 font-semibold">Prop</th>
            <th className="px-4 py-2 font-semibold">Type</th>
            <th className="px-4 py-2 font-semibold">Default</th>
            <th className="px-4 py-2 font-semibold">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-gray-200 dark:border-gray-700">
              <td className="px-4 py-2 font-mono text-hot-blue dark:text-hot-blue-light">{r.name}</td>
              <td className="px-4 py-2 text-gray-700 dark:text-gray-300"><code>{r.type}</code></td>
              <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{r.default ?? '-'}</td>
              <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
