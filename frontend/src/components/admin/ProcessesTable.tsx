interface Process {
  id: number;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'completed';
}

interface ProcessesTableProps {
  processes: Process[];
  onEditProcess?: (process: Process) => void;
  onDeleteProcess?: (processId: number) => void;
  onPauseProcess?: (processId: number) => void;
  onStopProcess?: (processId: number) => void;
  onRestartProcess?: (processId: number) => void;
  onRetryProcess?: (processId: number) => void;
}

export function ProcessesTable({ 
  processes, 
  onEditProcess,
  onDeleteProcess,
  onPauseProcess,
  onStopProcess,
  onRestartProcess,
  onRetryProcess
}: ProcessesTableProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Process Name</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Description</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {processes.map((process) => (
              <tr key={process.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm text-gray-700">{process.name}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{process.description}</td>
                <td className="px-6 py-4 text-sm">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      process.status === "active"
                        ? "bg-blue-100 text-blue-800"
                        : process.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {process.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm space-x-2">
                  <button
                    onClick={() => onEditProcess?.(process)}
                    className="px-2 py-1 text-sm bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteProcess?.(process.id)}
                    className="px-2 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                  >
                    Delete
                  </button>
                  {process.status === "active" && (
                    <>
                      <button
                        onClick={() => onPauseProcess?.(process.id)}
                        className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                      >
                        Pause
                      </button>
                      <button
                        onClick={() => onStopProcess?.(process.id)}
                        className="px-2 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                      >
                        Stop
                      </button>
                    </>
                  )}
                  {process.status === "completed" && (
                    <button
                      onClick={() => onRestartProcess?.(process.id)}
                      className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                      Restart
                    </button>
                  )}
                  {process.status === "inactive" && (
                    <button
                      onClick={() => onRetryProcess?.(process.id)}
                      className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                      Retry
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 