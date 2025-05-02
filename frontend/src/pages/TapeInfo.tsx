import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

interface Tape {
  id: number;
  tape_no: string;
  total_size: string;
  used_size: string;
  available_size: string;
  usage_percentage: number;
  updated_at: string;
}

interface GroupTapeInfo {
  group_name: string;
  tapes: Tape[];
}

const TapeInfo: React.FC = () => {
  const [data, setData] = useState<GroupTapeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTapeInfo = async () => {
      try {
        const response = await axios.get('/api/tapeinfo');
        // The tapes field is a JSON string, so parse it
        const parsed = response.data.map((row: any) => ({
          group_name: row.group_name,
          tapes: (typeof row.tapes === 'string' ? JSON.parse(row.tapes) : row.tapes).sort((a, b) => a.tape_no.localeCompare(b.tape_no))
        }));
        setData(parsed);
      } catch (err) {
        setError('Failed to fetch tape info');
      } finally {
        setLoading(false);
      }
    };
    fetchTapeInfo();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Tape Info</h1>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            Back to Home
          </button>
        </div>
        {data.map((group) => (
          <div key={group.group_name} className="mb-8">
            <h2 className="text-2xl font-semibold text-blue-900 mb-2">{group.group_name}</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 bg-white shadow rounded-lg">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Tape No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Total Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Used Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Available Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Usage %</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {group.tapes.map((tape) => (
                    <tr key={tape.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tape.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tape.tape_no}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tape.total_size}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tape.used_size}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tape.available_size}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tape.usage_percentage}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(tape.updated_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TapeInfo; 