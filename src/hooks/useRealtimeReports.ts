import { useEffect, useRef, useState } from 'react';
import { SupabaseService } from '../services/supabase';
import { NotificationService } from '../services/notificationService';
import { Report } from '../types';

interface UseRealtimeReportsOptions {
  onNewReport?: (report: Report) => void;
  onUpdateReport?: (report: Report) => void;
  onDeleteReport?: (reportId: string) => void;
  showNotifications?: boolean;
  enableComprehensiveNotifications?: boolean;
  currentUserId?: string;
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
    showNotifications = true,
    enableComprehensiveNotifications = true,
    currentUserId
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
              // Skip notifications for reports created by current user
              if (currentUserId && newReport.user_id === currentUserId) {
                console.log('🔕 Skipping notification for own report');
                onNewReport?.(newReport);
                return;
              }

              onNewReport?.(newReport);

              // Send comprehensive notification
              if (enableComprehensiveNotifications) {
                try {
                  await NotificationService.sendComprehensiveNotification(newReport, 'new');
                } catch (error) {
                  console.error('Error sending comprehensive notification:', error);
                }
              }

              // Show in-app notification
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
              // Skip notifications for reports updated by current user
              if (currentUserId && updatedReport.user_id === currentUserId) {
                console.log('🔕 Skipping notification for own report update');
                onUpdateReport?.(updatedReport);
                return;
              }

              onUpdateReport?.(updatedReport);

              // Send comprehensive notification for updates
              if (enableComprehensiveNotifications) {
                try {
                  await NotificationService.sendComprehensiveNotification(updatedReport, 'update');
                } catch (error) {
                  console.error('Error sending comprehensive notification for update:', error);
                }
              }

              // Show in-app notification
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
