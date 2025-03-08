import React, { useState } from 'react';
import { Calendar, Clock, User, FileText, AlertTriangle } from 'lucide-react';

// Define the log type for better type safety
type LogEntry = {
  fileName: string;
  userEmail?: string;
  action: string;
  status: string;
  timestamp: string;
  fileSize?: number;
  fileType?: string;
  cid?: string;
  errorDetails?: string;
  userAgent?: string;
};

interface ActivityTimelineProps {
  logs: LogEntry[];
}

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ logs = [] }) => {
  const [filter, setFilter] = useState('all'); // all, success, error
  const [actionFilter, setActionFilter] = useState('all'); // all, uploaded, viewed, etc.
  const [userFilter, setUserFilter] = useState('all');
  
  // Extract unique users for filter dropdown
  const uniqueUsers = Array.from(new Set(logs.map(log => log.userEmail || 'Unknown')));
  
  // Extract unique actions for filter dropdown
  const uniqueActions = Array.from(new Set(logs.map(log => log.action)));
  
  // Apply filters
  const filteredLogs = logs.filter(log => {
    const statusMatch = filter === 'all' || log.status === filter;
    const actionMatch = actionFilter === 'all' || log.action === actionFilter;
    const userMatch = userFilter === 'all' || (log.userEmail || 'Unknown') === userFilter;
    return statusMatch && actionMatch && userMatch;
  });
  
  // Group logs by date for the timeline
  const groupedLogs = filteredLogs.reduce<Record<string, LogEntry[]>>((groups, log) => {
    const date = new Date(log.timestamp).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(log);
    return groups;
  }, {});
  
  // Sort dates in descending order
  const sortedDates = Object.keys(groupedLogs).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );
  
  // Function to format time
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };
  
  // Function to get color based on action type
  const getActionColor = (action: string) => {
    const actionColors: Record<string, string> = {
      uploaded: 'bg-blue-500',
      retrieved: 'bg-green-500',
      viewed: 'bg-yellow-500',
      deleted: 'bg-red-500',
      list_files: 'bg-purple-500'
    };
    
    // Handle attempt actions
    if (action.includes('attempt')) {
      return 'bg-orange-500';
    }
    
    return actionColors[action] || 'bg-gray-500';
  };
  
  // Function to get icon based on action
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'uploaded':
        return <div className="w-6 h-6 flex items-center justify-center bg-blue-500 rounded-full text-white">⬆️</div>;
      case 'retrieved':
      case 'download_attempt':
        return <div className="w-6 h-6 flex items-center justify-center bg-green-500 rounded-full text-white">⬇️</div>;
      case 'viewed':
      case 'view_attempt':
        return <div className="w-6 h-6 flex items-center justify-center bg-yellow-500 rounded-full text-white">👁️</div>;
      case 'deleted':
      case 'delete_attempt':
        return <div className="w-6 h-6 flex items-center justify-center bg-red-500 rounded-full text-white">🗑️</div>;
      case 'list_files':
        return <div className="w-6 h-6 flex items-center justify-center bg-purple-500 rounded-full text-white">📋</div>;
      default:
        return <div className="w-6 h-6 flex items-center justify-center bg-gray-500 rounded-full text-white">❓</div>;
    }
  };

  // Helper function to format file size
  const formatFileSize = (size?: number) => {
    if (!size) return 'Unknown';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="w-full max-w-4xl bg-gray-800 p-6 rounded-lg shadow-lg text-white">
      <h2 className="text-xl font-semibold mb-6 text-blue-300">Activity Timeline</h2>
      
      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-fit">
          <label className="block text-sm font-medium mb-1 text-gray-400">Status</label>
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white"
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>
        </div>
        
        <div className="flex-1 min-w-fit">
          <label className="block text-sm font-medium mb-1 text-gray-400">Action</label>
          <select 
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white"
          >
            <option value="all">All Actions</option>
            {uniqueActions.map(action => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </div>
        
        <div className="flex-1 min-w-fit">
          <label className="block text-sm font-medium mb-1 text-gray-400">User</label>
          <select 
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white"
          >
            <option value="all">All Users</option>
            {uniqueUsers.map(user => (
              <option key={user} value={user}>{user}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Timeline */}
      <div className="space-y-8">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No activities match your filters
          </div>
        ) : (
          sortedDates.map(date => (
            <div key={date} className="mb-6">
              <div className="flex items-center mb-3">
                <Calendar className="h-5 w-5 mr-2 text-blue-400" />
                <h3 className="text-lg font-medium text-white">{date}</h3>
              </div>
              
              <div className="ml-4 space-y-4">
                {groupedLogs[date].sort((a, b) => 
                  new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                ).map((log, idx) => (
                  <div key={idx} className="relative pl-8 pb-4">
                    {/* Timeline connector line */}
                    {idx !== groupedLogs[date].length - 1 && (
                      <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-gray-600"></div>
                    )}
                    
                    {/* Timeline dot */}
                    <div className="absolute left-0 top-1">
                      {getActionIcon(log.action)}
                    </div>
                    
                    {/* Content */}
                    <div className={`bg-gray-700 rounded-lg p-4 border-l-4 ${log.status === 'success' ? 'border-green-500' : 'border-red-500'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center text-sm text-gray-300">
                          <Clock className="h-4 w-4 mr-1" />
                          <span>{formatTime(log.timestamp)}</span>
                        </div>
                        
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)} text-white`}>
                          {log.action}
                        </div>
                      </div>
                      
                      <div className="mb-2">
                        <span className="font-medium">File: </span>
                        <span className="text-gray-300">{log.fileName}</span>
                      </div>
                      
                      <div className="flex items-center mb-2 text-sm text-gray-300">
                        <User className="h-4 w-4 mr-1" />
                        <span>{log.userEmail || 'Unknown user'}</span>
                      </div>
                      
                      {log.fileSize && (
                        <div className="text-sm text-gray-400">
                          Size: {formatFileSize(log.fileSize)}
                        </div>
                      )}
                      
                      {log.errorDetails && (
                        <div className="mt-2 flex items-start text-red-400 text-sm">
                          <AlertTriangle className="h-4 w-4 mr-1 flex-shrink-0 mt-0.5" />
                          <span>{log.errorDetails}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActivityTimeline;