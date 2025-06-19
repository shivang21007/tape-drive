import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';
import { ToastContainer } from 'react-toastify';
import { FileDownload } from '../components/FileDownload';
import { FaCaretSquareUp, FaCaretSquareDown, FaTimes } from "react-icons/fa";
import debounce from 'lodash/debounce';

interface FileData {
  id: number;
  user_name: string;
  group_name: string;
  file_name: string;
  file_size: string;
  method: string;
  created_at: string;
  status: string;
  tape_number: string;
  iscached: 0 | 1;
  description?: string;
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

const Files: React.FC = () => {
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDescription, setEditingDescription] = useState<{ id: number; value: string } | null>(null);
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
    
    // Clear existing filter params
    filterOptions.forEach(option => {
      params.delete(option.value);
    });
    
    // Add new filter params
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

  const fetchFiles = useCallback(async (page: number, currentFilters: FilterCriteria[]) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sortOrder
      });

      // Add filters to params
      currentFilters.forEach(filter => {
        params.append(`${filter.field}`, filter.value);
      });

      const response = await axios.get(`/api/files?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data) {
        setFiles(response.data.files);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      toast.error('Error fetching files');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [sortOrder]);

  // Debounced fetch function
  const debouncedFetch = useCallback(
    debounce((page: number, filters: FilterCriteria[]) => {
      fetchFiles(page, filters);
    }, 600),
    [fetchFiles]
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
    
    // Check if filter for this field already exists
    const existingFilterIndex = filters.findIndex(f => f.field === selectedFilterField);
    
    let newFilters: FilterCriteria[];
    if (existingFilterIndex >= 0) {
      // Update existing filter
      newFilters = filters.map((f, index) => 
        index === existingFilterIndex ? newFilter : f
      );
    } else {
      // Add new filter
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
      await fetchFiles(currentPage, filters);
      toast.success('Files refreshed');
    } catch (error) {
      toast.error('Error refreshing files');
      console.error('Error:', error);
    }
  };

  

  const handleSort = () => {
    const newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newSortOrder);
  };

  const handleDescriptionEdit = (file: FileData) => {
    setEditingDescription({ id: file.id, value: file.description || '' });
  };

  const handleDescriptionSave = async (file: FileData) => {
    if (!editingDescription) return;

    try {
      const response = await axios.put(`/api/files/${file.id}/description`, {
        description: editingDescription.value
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if(response.status === 200){  
        // Update the local state
        const updatedFiles = files.map(f => 
          f.id === file.id ? { ...f, description: editingDescription.value } : f
        );
      setFiles(updatedFiles);
        
        setEditingDescription(null);
        toast.success('Description updated successfully');
      } else {
        toast.error('Failed to update description');
      }
    } catch (err) {
      console.error('Failed to update description:', err);
      toast.error('Failed to update description');
    }
  };

  const handleDescriptionCancel = () => {
    setEditingDescription(null);
  };

  if (loading && files.length === 0) {
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
          <h1 className="text-3xl font-bold text-gray-900">Files</h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleRefresh}
              className="px-2 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={() => navigate('/history')}
              className="px-2 py-1 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
            >
              Download History
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
            <button
              onClick={() => navigate('/')}
              className="px-2 py-1 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Home
            </button>
            {/* <SearchBar 
              data={files}
              onSearch={handleSearch}
              onSelect={handleSelect}
            /> */}
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-16">
                    ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-32">
                    Username
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-32">
                    Group
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-48">
                    Filename
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-48">
                    Description
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-32">
                    Size
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-32">
                    Method
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-40">
                    Upload Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-32">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-24">
                    Tape No.
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-20">
                    Cached
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-32">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {file.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {file.user_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {file.group_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="break-words max-w-xs">
                        {file.file_name || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                      {editingDescription?.id === file.id ? (
                        <div className="flex items-center space-x-1">
                          <input
                            type="text"
                            value={editingDescription.value}
                            onChange={(e) => setEditingDescription({ ...editingDescription, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleDescriptionSave(file);
                              if (e.key === 'Escape') handleDescriptionCancel();
                            }}
                            className="border rounded px-1 py-0.5 text-sm w-full"
                            autoFocus
                          />
                          <button
                            onClick={() => handleDescriptionSave(file)}
                            className="inline-text-btn text-green-600 hover:text-green-800"
                          >
                            ✓
                          </button>
                          <button
                            onClick={handleDescriptionCancel}
                            className="inline-text-btn text-red-600 hover:text-red-800"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1">
                          <div className="break-words flex-grow">
                            {file.description || '-'}
                          </div>
                          <button
                            onClick={() => handleDescriptionEdit(file)}
                            className="inline-text-btn text-blue-600 hover:text-blue-800"
                          >
                            ✎
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {file.file_size || '0 B'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {file.method || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(file.created_at).toLocaleString() || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${file.status === 'completed' ? 'bg-green-100 text-green-800' : 
                          file.status === 'failed' ? 'bg-red-100 text-red-800' : 
                          'bg-yellow-100 text-yellow-800'}`}>
                        {file.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {file.tape_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {file.iscached ? 'Yes' : 'No'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <FileDownload 
                        fileId={file.id}
                        fileName={file.file_name}
                        fileSize={file.file_size}
                        method={file.method}
                        iscached={file.iscached}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

export default Files;