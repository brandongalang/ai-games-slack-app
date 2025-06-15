/**
 * Simple tests for SecurityService focusing on public methods without database dependencies
 */

import { SecurityService } from '../../../src/services/securityService';

describe('SecurityService - Core Functions', () => {
  describe('sanitizeText', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello World';
      const result = SecurityService.sanitizeText(input);
      expect(result).toBe('Hello World');
    });

    it('should remove dangerous characters', () => {
      const input = 'Hello<>"\'World';
      const result = SecurityService.sanitizeText(input);
      expect(result).toBe('Hello&lt;&gt;World'); // DOMPurify escapes these characters
    });

    it('should handle empty strings', () => {
      const result = SecurityService.sanitizeText('');
      expect(result).toBe('');
    });

    it('should handle non-string input', () => {
      const result = SecurityService.sanitizeText(null as any);
      expect(result).toBe('');
    });

    it('should limit text length', () => {
      const longText = 'a'.repeat(20000);
      const result = SecurityService.sanitizeText(longText);
      expect(result.length).toBeLessThanOrEqual(10000);
    });
  });

  describe('sanitizeSubmissionData', () => {
    it('should sanitize all submission fields', () => {
      const data = {
        title: '<script>alert("xss")</script>Test Title',
        promptText: 'This is a <b>test</b> prompt',
        description: 'Test description with "quotes"',
        outputSample: 'Output with <script>bad</script>',
        tags: ['<script>tag1</script>', 'tag2"']
      };

      const result = SecurityService.sanitizeSubmissionData(data);

      expect(result.title).toBe('Test Title');
      expect(result.promptText).toBe('This is a test prompt');
      expect(result.description).toBe('Test description with quotes');
      expect(result.outputSample).toBe('Output with'); // Script tag content is removed
      expect(result.tags).toEqual(['tag2']); // First tag was empty after sanitization
    });

    it('should handle optional fields', () => {
      const data = {
        promptText: 'Test prompt'
      };

      const result = SecurityService.sanitizeSubmissionData(data);

      expect(result.title).toBeUndefined();
      expect(result.description).toBeUndefined();
      expect(result.outputSample).toBeUndefined();
      expect(result.tags).toEqual([]);
      expect(result.promptText).toBe('Test prompt');
    });
  });

  describe('validateSubmissionContent', () => {
    it('should accept valid content', () => {
      const content = 'This is a valid prompt with sufficient length for testing purposes.';
      const result = SecurityService.validateSubmissionContent(content);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject content that is too short', () => {
      const content = 'short';
      const result = SecurityService.validateSubmissionContent(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Prompt must be at least 10 characters long');
    });

    it('should reject content that is too long', () => {
      const content = 'a'.repeat(6000);
      const result = SecurityService.validateSubmissionContent(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Prompt must be less than 5000 characters');
    });

    it('should detect harmful patterns', () => {
      const harmfulContent = 'This prompt contains eval(maliciousCode) which is dangerous';
      const result = SecurityService.validateSubmissionContent(harmfulContent);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Content contains potentially harmful patterns');
    });
  });

  describe('isAdmin', () => {
    it('should return true for admin users', () => {
      const result = SecurityService.isAdmin('U12345');
      expect(result).toBe(true);
    });

    it('should return false for non-admin users', () => {
      const result = SecurityService.isAdmin('U99999');
      expect(result).toBe(false);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate token of correct length', () => {
      const token = SecurityService.generateSecureToken(16);
      expect(token).toHaveLength(16);
    });

    it('should generate different tokens each time', () => {
      const token1 = SecurityService.generateSecureToken(32);
      const token2 = SecurityService.generateSecureToken(32);
      expect(token1).not.toBe(token2);
    });

    it('should use default length when not specified', () => {
      const token = SecurityService.generateSecureToken();
      expect(token).toHaveLength(32);
    });
  });

  describe('detectPotentialPII', () => {
    it('should detect email addresses', () => {
      const text = 'Contact me at test@example.com for more info';
      const result = SecurityService.detectPotentialPII(text);

      expect(result.hasPII).toBe(true);
      expect(result.detectedTypes).toContain('email');
      expect(result.warnings).toContain('Email addresses detected');
    });

    it('should detect phone numbers', () => {
      const text = 'Call me at (555) 123-4567 today';
      const result = SecurityService.detectPotentialPII(text);

      expect(result.hasPII).toBe(true);
      expect(result.detectedTypes).toContain('phone');
      expect(result.warnings).toContain('Phone numbers detected');
    });

    it('should return false for clean text', () => {
      const text = 'This is completely clean text with no personal information';
      const result = SecurityService.detectPotentialPII(text);

      expect(result.hasPII).toBe(false);
      expect(result.detectedTypes).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('validateAdminCommand', () => {
    it('should validate allowed commands', () => {
      const result = SecurityService.validateAdminCommand('analyze', ['arg1', 'arg2']);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.sanitizedArgs).toEqual(['arg1', 'arg2']);
    });

    it('should reject invalid commands', () => {
      const result = SecurityService.validateAdminCommand('malicious', ['arg1']);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid admin command');
    });

    it('should sanitize arguments', () => {
      const result = SecurityService.validateAdminCommand('analyze', ['<script>test</script>']);
      
      expect(result.sanitizedArgs[0]).toBe(''); // Script tags are completely removed
    });
  });
});