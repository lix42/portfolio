import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { HealthStatus, type ServiceHealth } from './HealthStatus';

describe('HealthStatus', () => {
  const defaultProps = {
    message: 'Service is running',
  };

  describe('when service is healthy', () => {
    const healthyService: ServiceHealth = {
      ok: true,
      version: '1.0.0',
      error: null,
    };

    it('should display "Healthy" status badge', () => {
      render(<HealthStatus {...defaultProps} health={healthyService} />);
      expect(screen.getByText('Healthy')).toBeInTheDocument();
    });

    it('should display the version', () => {
      render(<HealthStatus {...defaultProps} health={healthyService} />);
      expect(screen.getByText('1.0.0')).toBeInTheDocument();
    });

    it('should display the message', () => {
      render(<HealthStatus {...defaultProps} health={healthyService} />);
      expect(screen.getByText('Service is running')).toBeInTheDocument();
    });

    it('should not display error section', () => {
      render(<HealthStatus {...defaultProps} health={healthyService} />);
      expect(screen.queryByText('Error Details')).not.toBeInTheDocument();
    });
  });

  describe('when service is unhealthy', () => {
    const unhealthyService: ServiceHealth = {
      ok: false,
      version: '1.0.0',
      error: 'Connection timeout',
    };

    it('should display "Unavailable" status badge', () => {
      render(<HealthStatus {...defaultProps} health={unhealthyService} />);
      expect(screen.getByText('Unavailable')).toBeInTheDocument();
    });

    it('should display the version', () => {
      render(<HealthStatus {...defaultProps} health={unhealthyService} />);
      expect(screen.getByText('1.0.0')).toBeInTheDocument();
    });

    it('should display error details', () => {
      render(<HealthStatus {...defaultProps} health={unhealthyService} />);
      expect(screen.getByText('Error Details')).toBeInTheDocument();
      expect(screen.getByText('Connection timeout')).toBeInTheDocument();
    });
  });

  describe('when service is healthy but with no error', () => {
    const healthyServiceNoError: ServiceHealth = {
      ok: true,
      version: '2.5.1',
      error: null,
    };

    it('should not display error section when error is null', () => {
      render(<HealthStatus {...defaultProps} health={healthyServiceNoError} />);
      expect(screen.queryByText('Error Details')).not.toBeInTheDocument();
    });
  });

  describe('version display', () => {
    it('should display different version numbers correctly', () => {
      const service: ServiceHealth = {
        ok: true,
        version: '3.14.159',
        error: null,
      };

      render(<HealthStatus {...defaultProps} health={service} />);
      expect(screen.getByText('3.14.159')).toBeInTheDocument();
    });
  });

  describe('message prop', () => {
    const service: ServiceHealth = {
      ok: true,
      version: '1.0.0',
      error: null,
    };

    it('should display custom messages', () => {
      render(
        <HealthStatus message="Custom health check message" health={service} />
      );
      expect(
        screen.getByText('Custom health check message')
      ).toBeInTheDocument();
    });
  });
});
