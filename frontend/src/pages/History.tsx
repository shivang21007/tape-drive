import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import debounce from 'lodash/debounce';
import { FaCaretSquareUp, FaCaretSquareDown, FaTimes } from "react-icons/fa";


interface HistoryItem {
  id: number;
  file_id: number;
  user_name: string;
  group_name: string;
  file_name: string;
  file_size: string;
  tape_number: string;
  description?: string;
  status: 'requested' | 'processing' | 'completed' | 'failed';
  served_from: string | null;
  served_to: string | null;
  requested_at: string;
  completed_at: string | null;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface FilterCriteria {
  field: 'user_name' | 'file_name' | 'tape_number' | 'description';
  value: string;
}

interface FilterOption {
  label: string;
  value: FilterCriteria['field'];
}

const filterOptions: FilterOption[] = [
  { label: 'Username', value: 'user_name' },
  { label: 'Filename', value: 'file_name' },
  { label: 'Tape Number', value: 'tape_number' },
  { label: 'Description', value: 'description' }
];

const History: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<FilterCriteria[]>([]);
  const [selectedFilterField, setSelectedFilterField] = useState<FilterCriteria['field']>('file_name');
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0
  });

  // Convert filters to URL parameters
  const updateUrlParams = useCallback((newFilters: FilterCriteria[]) => {
    const params = new URLSearchParams(searchParams);
    filterOptions.forEach(option => {
      params.delete(option.value);
    });
    newFilters.forEach(filter => {
      params.append(filter.field, filter.value);
    });
    setSearchParams(params);
  }, [setSearchParams, searchParams]);

  // Initialize filters from URL params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const initialFilters: FilterCriteria[] = [];
    filterOptions.forEach(option => {
      const value = params.get(option.value);
      if (value) {
        initialFilters.push({ field: option.value, value });
      }
    });
    setFilters(initialFilters);
  }, [location.search]);

  const fetchHistory = useCallback(async (page: number, currentFilters: FilterCriteria[]) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sortOrder
      });
      currentFilters.forEach(filter => {
        params.append(`${filter.field}`, filter.value);
      });
      const response = await axios.get(`/api/history?${params.toString()}`);
      if (response.data) {
        setHistory(response.data.history);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      toast.error('Failed to fetch history');
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  }, [sortOrder]);

  // Debounced fetch function
  const debouncedFetch = useCallback(
    debounce((page: number, filters: FilterCriteria[]) => {
      fetchHistory(page, filters);
    }, 600),
    [fetchHistory]
  );

  useEffect(() => {
    debouncedFetch(currentPage, filters);
    return () => {
      debouncedFetch.cancel();
    };
  }, [currentPage, sortOrder, filters, debouncedFetch]);

  const handleFilterChange = (value: string) => {
    const newFilter: FilterCriteria = {
      field: selectedFilterField,
      value
    };
    const existingFilterIndex = filters.findIndex(f => f.field === selectedFilterField);
    let newFilters: FilterCriteria[];
    if (existingFilterIndex >= 0) {
      newFilters = filters.map((f, index) =>
        index === existingFilterIndex ? newFilter : f
      );
    } else {
      newFilters = [...filters, newFilter];
    }
    setFilters(newFilters);
    updateUrlParams(newFilters);
    setCurrentPage(1);
  };

  const removeFilter = (field: FilterCriteria['field']) => {
    const newFilters = filters.filter(f => f.field !== field);
    setFilters(newFilters);
    updateUrlParams(newFilters);
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setFilters([]);
    updateUrlParams([]);
    setCurrentPage(1);
  };

  const handleRefresh = async () => {
    try {
      await fetchHistory(currentPage, filters);
      toast.success('History refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh history');
      console.error('Error refreshing history:', error);
    }
  };

  const handleSort = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  if (loading && history.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <div className="table-custome-width mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Download History</h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleRefresh}
              className="px-2 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-2 py-1 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Home
            </button>
            <button
              onClick={() => navigate('/files')}
              className="px-2 py-1 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Files
            </button>
            <button
              onClick={handleSort}
              className="px-2 py-1 text-sm bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors flex items-center space-x-2"
            >
              <span>{sortOrder === 'asc' ? 'Recent' : 'Oldest'} </span>
              {sortOrder === 'asc' ? (
                <FaCaretSquareUp className="w-3 h-3" />
              ) : (
                <FaCaretSquareDown className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {/* Filter Section */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow">
          <div className="flex items-center space-x-4 mb-4">
            <select
              value={selectedFilterField}
              onChange={(e) => setSelectedFilterField(e.target.value as FilterCriteria['field'])}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {filterOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Enter filter value..."
              value={filters.find(f => f.field === selectedFilterField)?.value || ''}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {/* Active Filters */}
          {filters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {filters.map(filter => (
                <div
                  key={filter.field}
                  className="flex items-center bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs"
                >
                  <span className="mr-1">{filterOptions.find(o => o.value === filter.field)?.label}: {filter.value}</span>
                  <button
                    onClick={() => removeFilter(filter.field)}
                    className="inline-text-btn text-blue-600 hover:text-blue-800 p-0 m-0 h-4 w-4 flex items-center justify-center"
                    style={{ lineHeight: 1, minWidth: 'unset', minHeight: 'unset' }}
                    tabIndex={-1}
                  >
                    <FaTimes className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={clearAllFilters}
                className="text-xs text-red-600 hover:text-red-800 ml-1 px-1 py-0.5 border border-red-200 rounded"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  File ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Username
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Group
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Filename
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Description
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Tape No.
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Size
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Served From
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Served To
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Requested At
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Completed At
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {history.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.file_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.user_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.group_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.file_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.description || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.tape_number || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.file_size}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${item.status === 'completed' ? 'bg-green-100 text-green-800' : 
                        item.status === 'failed' ? 'bg-red-100 text-red-800' : 
                        item.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.served_from ? item.served_from : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.served_to ? item.served_to : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(item.requested_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.completed_at ? new Date(item.completed_at).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.totalPages))}
                disabled={currentPage === pagination.totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{((currentPage - 1) * pagination.limit) + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(currentPage * pagination.limit, pagination.total)}</span>{' '}
                  of <span className="font-medium">{pagination.total}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  {[...Array(pagination.totalPages)].map((_, index) => (
                    <button
                      key={index + 1}
                      onClick={() => setCurrentPage(index + 1)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium
                        ${currentPage === index + 1
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                      {index + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.totalPages))}
                    disabled={currentPage === pagination.totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default History; 