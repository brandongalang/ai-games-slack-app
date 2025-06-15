import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { body, validationResult } from 'express-validator';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { supabaseAdmin } from '../database/supabase';

// Create DOMPurify instance for server-side sanitization
const window = new JSDOM('').window;
const purify = DOMPurify(window);

export class SecurityService {
  // Rate limiting configurations
  static readonly RATE_LIMITS = {
    SUBMISSION: {
      windowMs: 60 * 1000, // 1 minute
      max: 5, // max 5 submissions per minute per user
      message: '⚠️ Too many submissions. Please wait before submitting again.',
      skipSuccessfulRequests: false
    },
    COMMENTS: {
      windowMs: 60 * 1000, // 1 minute
      max: 10, // max 10 comments per minute per user
      message: '⚠️ Too many comments. Please slow down.',
      skipSuccessfulRequests: false
    },
    GENERAL: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // max 100 requests per 15 minutes per IP
      message: '⚠️ Too many requests. Please try again later.',
      skipSuccessfulRequests: true
    }
  };

  // Slow down configurations
  static readonly SLOW_DOWN = {
    SUBMISSION: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      delayAfter: 3, // start slowing down after 3 requests
      delayMs: 500 // delay by 500ms for each request after delayAfter
    }
  };

  /**
   * Create rate limiter middleware
   */
  static createRateLimit(config: typeof SecurityService.RATE_LIMITS.SUBMISSION) {
    return rateLimit({
      ...config,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        // Use Slack user ID if available, fallback to IP
        return (req as any).body?.user_id || req.ip;
      }
    });
  }

  /**
   * Create slow down middleware
   */
  static createSlowDown(config: typeof SecurityService.SLOW_DOWN.SUBMISSION) {
    return slowDown({
      ...config,
      keyGenerator: (req) => {
        return (req as any).body?.user_id || req.ip;
      }
    });
  }

  /**
   * Sanitize text input to prevent XSS and injection attacks
   */
  static sanitizeText(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    // Remove any HTML tags and potential script injections
    const sanitized = purify.sanitize(input, { 
      ALLOWED_TAGS: [], // No HTML tags allowed
      ALLOWED_ATTR: [] // No attributes allowed
    });

    // Additional sanitization for SQL injection prevention
    return sanitized
      .replace(/[<>'"]/g, '') // Remove potentially dangerous characters
      .trim()
      .substring(0, 10000); // Limit length to prevent DoS
  }

  /**
   * Sanitize and validate submission data
   */
  static sanitizeSubmissionData(data: {
    title?: string;
    promptText: string;
    description?: string;
    outputSample?: string;
    tags?: string[];
  }) {
    return {
      title: data.title ? this.sanitizeText(data.title).substring(0, 200) : undefined,
      promptText: this.sanitizeText(data.promptText).substring(0, 5000),
      description: data.description ? this.sanitizeText(data.description).substring(0, 1000) : undefined,
      outputSample: data.outputSample ? this.sanitizeText(data.outputSample).substring(0, 2000) : undefined,
      tags: data.tags ? data.tags.map(tag => this.sanitizeText(tag).substring(0, 50)).filter(tag => tag.length > 0) : []
    };
  }

  /**
   * Validate submission content for basic quality and safety
   */
  static validateSubmissionContent(promptText: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check minimum length
    if (promptText.length < 10) {
      errors.push('Prompt must be at least 10 characters long');
    }

    // Check maximum length
    if (promptText.length > 5000) {
      errors.push('Prompt must be less than 5000 characters');
    }

    // Check for potentially harmful content patterns
    const harmfulPatterns = [
      /\b(eval|exec|system|shell_exec|passthru|file_get_contents|file_put_contents|fopen|fwrite)\s*\(/i,
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /\bDROP\s+TABLE\b/gi,
      /\bDELETE\s+FROM\b/gi,
      /\bINSERT\s+INTO\b/gi,
      /\bUPDATE\s+.*\s+SET\b/gi
    ];

    for (const pattern of harmfulPatterns) {
      if (pattern.test(promptText)) {
        errors.push('Content contains potentially harmful patterns');
        break;
      }
    }

    // Check for excessive repetition (potential spam)
    const words = promptText.toLowerCase().split(/\s+/);
    const wordCount = new Map<string, number>();
    
    for (const word of words) {
      if (word.length > 2) {
        wordCount.set(word, (wordCount.get(word) || 0) + 1);
      }
    }

    const maxWordFrequency = Math.max(...Array.from(wordCount.values()));
    if (maxWordFrequency > words.length * 0.3) {
      errors.push('Content appears to be spam or excessively repetitive');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check for suspicious user behavior patterns
   */
  static async checkUserBehavior(userId: number): Promise<{
    isSuspicious: boolean;
    reasons: string[];
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    const reasons: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    try {
      // Check submission frequency
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const { count: recentSubmissions } = await supabaseAdmin
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', userId)
        .gte('created_at', oneHourAgo.toISOString());

      if ((recentSubmissions || 0) > 10) {
        reasons.push('Excessive submission frequency');
        riskLevel = 'high';
      } else if ((recentSubmissions || 0) > 5) {
        reasons.push('High submission frequency');
        riskLevel = 'medium';
      }

      // Check for duplicate content
      const { data: recentUserSubmissions } = await supabaseAdmin
        .from('submissions')
        .select('prompt_text')
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentUserSubmissions && recentUserSubmissions.length > 1) {
        const texts = recentUserSubmissions.map(s => s.prompt_text.toLowerCase());
        const duplicates = texts.filter((text, index) => 
          texts.indexOf(text) !== index
        );

        if (duplicates.length > 0) {
          reasons.push('Duplicate content detected');
          riskLevel = riskLevel === 'high' ? 'high' : 'medium';
        }
      }

      // Check account age vs activity
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('created_at, total_xp')
        .eq('user_id', userId)
        .single();

      if (user) {
        const accountAge = Date.now() - new Date(user.created_at).getTime();
        const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);
        
        // New account with high activity
        if (daysSinceCreation < 1 && (recentSubmissions || 0) > 3) {
          reasons.push('New account with high activity');
          riskLevel = riskLevel === 'high' ? 'high' : 'medium';
        }
      }

    } catch (error) {
      console.error('Error checking user behavior:', error);
    }

    return {
      isSuspicious: reasons.length > 0,
      reasons,
      riskLevel
    };
  }

  /**
   * Log security events for audit purposes
   */
  static async logSecurityEvent(event: {
    userId?: number;
    slackUserId?: string;
    eventType: 'rate_limit_exceeded' | 'suspicious_behavior' | 'validation_failed' | 'content_blocked' | 'admin_action';
    description: string;
    riskLevel: 'low' | 'medium' | 'high';
    metadata?: Record<string, any>;
  }) {
    try {
      await supabaseAdmin
        .from('security_logs')
        .insert({
          user_id: event.userId || null,
          slack_user_id: event.slackUserId || null,
          event_type: event.eventType,
          description: event.description,
          risk_level: event.riskLevel,
          metadata: event.metadata || {},
          created_at: new Date().toISOString()
        });

      console.log(`[SECURITY] ${event.eventType}: ${event.description}`, {
        userId: event.userId,
        slackUserId: event.slackUserId,
        riskLevel: event.riskLevel
      });

    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }

  /**
   * Check if user has admin privileges
   */
  static isAdmin(slackUserId: string): boolean {
    const adminUsers = (process.env.ADMIN_USERS || '').split(',').map(u => u.trim());
    return adminUsers.includes(slackUserId);
  }

  /**
   * Validate and sanitize admin commands
   */
  static validateAdminCommand(command: string, args: string[]): {
    isValid: boolean;
    sanitizedArgs: string[];
    errors: string[];
  } {
    const errors: string[] = [];
    const sanitizedArgs = args.map(arg => this.sanitizeText(arg));

    // Validate command against whitelist
    const allowedCommands = [
      'analyze', 'stats', 'check', 'reanalyze', 'review'
    ];

    if (!allowedCommands.includes(command.toLowerCase())) {
      errors.push('Invalid admin command');
    }

    // Validate arguments
    sanitizedArgs.forEach((arg, index) => {
      if (arg.length === 0 && args[index].length > 0) {
        errors.push(`Invalid argument at position ${index + 1}`);
      }
    });

    return {
      isValid: errors.length === 0,
      sanitizedArgs,
      errors
    };
  }

  /**
   * Generate secure random token for session management
   */
  static generateSecureToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Hash sensitive data for storage
   */
  static async hashSensitiveData(data: string): Promise<string> {
    // In a real implementation, use bcrypt or similar
    // For now, using a simple hash
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Check content for potential PII and warn user
   */
  static detectPotentialPII(text: string): {
    hasPII: boolean;
    detectedTypes: string[];
    warnings: string[];
  } {
    const warnings: string[] = [];
    const detectedTypes: string[] = [];

    // Email pattern
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    if (emailPattern.test(text)) {
      detectedTypes.push('email');
      warnings.push('Email addresses detected');
    }

    // Phone number patterns
    const phonePattern = /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;
    if (phonePattern.test(text)) {
      detectedTypes.push('phone');
      warnings.push('Phone numbers detected');
    }

    // Social Security Number pattern (US)
    const ssnPattern = /\b\d{3}-?\d{2}-?\d{4}\b/g;
    if (ssnPattern.test(text)) {
      detectedTypes.push('ssn');
      warnings.push('Potential SSN detected');
    }

    // Credit card pattern (basic)
    const ccPattern = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
    if (ccPattern.test(text)) {
      detectedTypes.push('credit_card');
      warnings.push('Potential credit card number detected');
    }

    return {
      hasPII: detectedTypes.length > 0,
      detectedTypes,
      warnings
    };
  }
}