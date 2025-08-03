import { SupabaseService } from './supabase';
import { ReportCategory } from '../types';

export class ReportExpiryService {
  private static instance: ReportExpiryService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Expiry times in minutes for each category
  private static readonly EXPIRY_TIMES: Record<ReportCategory, number> = {
    'police_checkpoint': 5,    // 5 minutes
    'weather_alert': 2,        // 2 minutes  
    'accident': 2,             // 2 minutes
    'general': 10,             // 10 minutes
    'road_hazard': 15,         // 15 minutes
    'traffic_jam': 15,         // 15 minutes
  };

  // Check interval in milliseconds (every 30 seconds)
  private static readonly CHECK_INTERVAL = 30 * 1000;

  static getInstance(): ReportExpiryService {
    if (!ReportExpiryService.instance) {
      ReportExpiryService.instance = new ReportExpiryService();
    }
    return ReportExpiryService.instance;
  }

  /**
   * Start the automatic expiry checking service
   */
  start(): void {
    if (this.isRunning) {
      console.log('⏰ Report expiry service is already running');
      return;
    }

    console.log('⏰ Starting report expiry service...');
    this.isRunning = true;

    // Run initial check
    this.checkExpiredReports();

    // Set up interval for periodic checks
    this.intervalId = setInterval(() => {
      this.checkExpiredReports();
    }, ReportExpiryService.CHECK_INTERVAL);

    console.log('✅ Report expiry service started successfully');
  }

  /**
   * Stop the automatic expiry checking service
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('⏰ Report expiry service is not running');
      return;
    }

    console.log('⏰ Stopping report expiry service...');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('✅ Report expiry service stopped');
  }

  /**
   * Check for expired reports and mark them as expired
   */
  private async checkExpiredReports(): Promise<void> {
    try {
      console.log('🔍 Checking for expired reports...');

      // Get all reports and filter for active ones
      const { data: allReports, error } = await SupabaseService.getReports();

      if (allReports) {
        console.log(`📊 Total reports found: ${allReports.length}`);
        const statusCounts = allReports.reduce((acc, report) => {
          acc[report.status] = (acc[report.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log('📊 Report status breakdown:', statusCounts);
      }

      const reports = allReports?.filter(report => report.status === 'active') || [];
      
      if (error) {
        console.error('❌ Error fetching reports for expiry check:', error);
        return;
      }

      if (!reports || reports.length === 0) {
        console.log('📝 No active reports to check for expiry');
        return;
      }

      console.log(`📊 Found ${reports.length} active reports to check for expiry`);

      const now = new Date();
      const expiredReportIds: string[] = [];

      // Check each report for expiry
      for (const report of reports) {
        const expiryMinutes = ReportExpiryService.EXPIRY_TIMES[report.category];
        const updatedAt = new Date(report.updated_at || report.created_at);
        const expiryTime = new Date(updatedAt.getTime() + (expiryMinutes * 60 * 1000));

        if (now >= expiryTime) {
          expiredReportIds.push(report.id);
          console.log(`⏰ Report ${report.id} (${report.category}) has expired`);
        }
      }

      // Mark expired reports
      if (expiredReportIds.length > 0) {
        await this.markReportsAsExpired(expiredReportIds);
        console.log(`✅ Marked ${expiredReportIds.length} reports as expired`);
      } else {
        console.log('✅ No reports have expired');
      }

    } catch (error) {
      console.error('❌ Error during expiry check:', error);
    }
  }

  /**
   * Mark multiple reports as expired in the database
   */
  private async markReportsAsExpired(reportIds: string[]): Promise<void> {
    try {
      const { error } = await SupabaseService.markReportsAsExpired(reportIds);
      
      if (error) {
        console.error('❌ Error marking reports as expired:', error);
        throw error;
      }

      console.log(`✅ Successfully marked ${reportIds.length} reports as expired`);
    } catch (error) {
      console.error('❌ Failed to mark reports as expired:', error);
      throw error;
    }
  }

  /**
   * Get the expiry time for a specific category
   */
  static getExpiryTimeForCategory(category: ReportCategory): number {
    return ReportExpiryService.EXPIRY_TIMES[category];
  }

  /**
   * Calculate when a report will expire
   */
  static calculateExpiryTime(category: ReportCategory, updatedAt: string): Date {
    const expiryMinutes = ReportExpiryService.EXPIRY_TIMES[category];
    const updatedDate = new Date(updatedAt);
    return new Date(updatedDate.getTime() + (expiryMinutes * 60 * 1000));
  }

  /**
   * Check if a report is expired
   */
  static isReportExpired(category: ReportCategory, updatedAt: string): boolean {
    const expiryTime = ReportExpiryService.calculateExpiryTime(category, updatedAt);
    return new Date() >= expiryTime;
  }

  /**
   * Get time remaining until expiry in minutes
   */
  static getTimeUntilExpiry(category: ReportCategory, updatedAt: string): number {
    const expiryTime = ReportExpiryService.calculateExpiryTime(category, updatedAt);
    const now = new Date();
    const diffMs = expiryTime.getTime() - now.getTime();
    return Math.max(0, Math.floor(diffMs / (60 * 1000)));
  }

  /**
   * Check if a report is about to expire (within 1 minute)
   */
  static isReportAboutToExpire(category: ReportCategory, updatedAt: string): boolean {
    const timeRemaining = ReportExpiryService.getTimeUntilExpiry(category, updatedAt);
    return timeRemaining <= 1 && timeRemaining > 0;
  }

  /**
   * Get the current status of the expiry service
   */
  getStatus(): { isRunning: boolean; checkInterval: number } {
    return {
      isRunning: this.isRunning,
      checkInterval: ReportExpiryService.CHECK_INTERVAL
    };
  }
}

// Export singleton instance
export const reportExpiryService = ReportExpiryService.getInstance();
