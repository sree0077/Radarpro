import { useEffect, useRef, useState } from 'react';
import { SupabaseService } from '../services/supabase';
import { Report } from '../types';

interface UseRealtimeReportsOptions {
  onNewReport?: (report: Report) => void;
  onUpdateReport?: (report: Report) => void;
  onDeleteReport?: (reportId: string) => void;
  showNotifications?: boolean;
}

interface RealtimeNotification {
  message: string;
  type: 'new' | 'update' | 'delete';
}

export const useRealtimeReports = (options: UseRealtimeReportsOptions = {}) => {
  const {
    onNewReport,
    onUpdateReport,
    onDeleteReport,
    showNotifications = true
  } = options;

  const [notification, setNotification] = useState<RealtimeNotification | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionRef = useRef<any>(null);

  const showNotification = (message: string, type: RealtimeNotification['type']) => {
    if (showNotifications) {
      setNotification({ message, type });
    }
  };

  const hideNotification = () => {
    setNotification(null);
  };

  useEffect(() => {
    const setupSubscription = () => {
      console.log('🔗 Setting up real-time reports subscription...');

      const subscription = SupabaseService.subscribeToReports(async (payload) => {
        console.log('📡 Real-time update received:', payload.eventType);

        try {
          if (payload.eventType === 'INSERT') {
            // Fetch complete report data with user info for new reports
            const { data: newReport, error } = await SupabaseService.getReportById(payload.new.id);
            if (error) {
              console.error('Error fetching new report:', error);
              return;
            }
            if (newReport) {
              onNewReport?.(newReport);
              showNotification(
                `New ${newReport.category} report by ${newReport.user?.username || 'Anonymous'}`,
                'new'
              );
            }
          } else if (payload.eventType === 'UPDATE') {
            // Fetch updated report data with user info
            const { data: updatedReport, error } = await SupabaseService.getReportById(payload.new.id);
            if (error) {
              console.error('Error fetching updated report:', error);
              return;
            }
            if (updatedReport) {
              onUpdateReport?.(updatedReport);
              showNotification(
                `Report updated by ${updatedReport.user?.username || 'Anonymous'}`,
                'update'
              );
            }
          } else if (payload.eventType === 'DELETE') {
            onDeleteReport?.(payload.old.id);
            showNotification('Report removed', 'delete');
          }
        } catch (error) {
          console.error('Error handling real-time update:', error);
        }
      });

      subscriptionRef.current = subscription;
      setIsConnected(true);

      return subscription;
    };

    const subscription = setupSubscription();

    // Cleanup subscription on unmount
    return () => {
      console.log('🔌 Cleaning up real-time subscription...');
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        setIsConnected(false);
      }
    };
  }, [onNewReport, onUpdateReport, onDeleteReport, showNotifications]);

  return {
    notification,
    hideNotification,
    isConnected,
    subscription: subscriptionRef.current
  };
};

// Hook specifically for managing reports state with real-time updates
export const useRealtimeReportsState = (initialReports: Report[] = []) => {
  const [reports, setReports] = useState<Report[]>(initialReports);

  const handleNewReport = (newReport: Report) => {
    setReports(prev => {
      // Check if report already exists to prevent duplicates
      const exists = prev.some(r => r.id === newReport.id);
      if (exists) return prev;
      return [newReport, ...prev];
    });
  };

  const handleUpdateReport = (updatedReport: Report) => {
    setReports(prev =>
      prev.map(report =>
        report.id === updatedReport.id ? updatedReport : report
      )
    );
  };

  const handleDeleteReport = (reportId: string) => {
    setReports(prev =>
      prev.filter(report => report.id !== reportId)
    );
  };

  const realtimeHook = useRealtimeReports({
    onNewReport: handleNewReport,
    onUpdateReport: handleUpdateReport,
    onDeleteReport: handleDeleteReport,
  });

  const updateReports = (newReports: Report[]) => {
    setReports(newReports);
  };

  return {
    reports,
    updateReports,
    setReports,
    ...realtimeHook
  };
};
