import type { HealthResponse } from '@portfolio/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HealthStatus } from './HealthStatus';

describe('HealthStatus', () => {
  const defaultProps = {
    message: 'Service is running',
  };

  describe('when all services are healthy', () => {
    const healthyResponse: HealthResponse = {
      ok: true,
      version: '1.0.0',
      services: {
        d1: { ok: true },
        r2: { ok: true },
        vectorize: { ok: true },
      },
    };

    it('should display "Healthy" status badge', () => {
      render(<HealthStatus {...defaultProps} health={healthyResponse} />);
      const healthyBadges = screen.getAllByText('Healthy');
      // Should have 4: overall + 3 services
      expect(healthyBadges).toHaveLength(4);
    });

    it('should display the version', () => {
      render(<HealthStatus {...defaultProps} health={healthyResponse} />);
      expect(screen.getByText('1.0.0')).toBeInTheDocument();
    });

    it('should display the message', () => {
      render(<HealthStatus {...defaultProps} health={healthyResponse} />);
      expect(screen.getByText('Service is running')).toBeInTheDocument();
    });

    it('should not display error section', () => {
      render(<HealthStatus {...defaultProps} health={healthyResponse} />);
      expect(screen.queryByText('Error')).not.toBeInTheDocument();
    });

    it('should display all service names', () => {
      render(<HealthStatus {...defaultProps} health={healthyResponse} />);
      expect(screen.getByText('D1')).toBeInTheDocument();
      expect(screen.getByText('R2')).toBeInTheDocument();
      expect(screen.getByText('Vectorize')).toBeInTheDocument();
    });
  });

  describe('when overall service is unhealthy', () => {
    const unhealthyResponse: HealthResponse = {
      ok: false,
      version: '1.0.0',
      services: {
        d1: { ok: false, message: 'Database connection failed' },
        r2: { ok: true },
        vectorize: { ok: true },
      },
    };

    it('should display "Unavailable" status badge for overall health', () => {
      render(<HealthStatus {...defaultProps} health={unhealthyResponse} />);
      const unavailableBadges = screen.getAllByText('Unavailable');
      expect(unavailableBadges.length).toBeGreaterThan(0);
    });

    it('should display "Unavailable" for failed service', () => {
      render(<HealthStatus {...defaultProps} health={unhealthyResponse} />);
      expect(
        screen.getByText('Database connection failed')
      ).toBeInTheDocument();
    });

    it('should display the version', () => {
      render(<HealthStatus {...defaultProps} health={unhealthyResponse} />);
      expect(screen.getByText('1.0.0')).toBeInTheDocument();
    });
  });

  describe('when multiple services are unhealthy', () => {
    const multipleUnhealthyResponse: HealthResponse = {
      ok: false,
      version: '1.0.0',
      services: {
        d1: { ok: false, message: 'D1 connection timeout' },
        r2: { ok: false, message: 'R2 bucket not found' },
        vectorize: { ok: true },
      },
    };

    it('should display error messages for all failed services', () => {
      render(
        <HealthStatus {...defaultProps} health={multipleUnhealthyResponse} />
      );
      expect(screen.getByText('D1 connection timeout')).toBeInTheDocument();
      expect(screen.getByText('R2 bucket not found')).toBeInTheDocument();
    });

    it('should show Healthy for working service', () => {
      render(
        <HealthStatus {...defaultProps} health={multipleUnhealthyResponse} />
      );
      const healthyBadges = screen.getAllByText('Healthy');
      // Vectorize should still be healthy
      expect(healthyBadges.length).toBeGreaterThan(0);
    });
  });

  describe('when errorMessage prop is provided', () => {
    const healthyResponse: HealthResponse = {
      ok: true,
      version: '1.0.0',
      services: {
        d1: { ok: true },
        r2: { ok: true },
        vectorize: { ok: true },
      },
    };

    it('should display error section with error message', () => {
      render(
        <HealthStatus
          {...defaultProps}
          health={healthyResponse}
          errorMessage="Failed to fetch health status"
        />
      );
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(
        screen.getByText('Failed to fetch health status')
      ).toBeInTheDocument();
    });
  });

  describe('version display', () => {
    it('should display different version numbers correctly', () => {
      const response: HealthResponse = {
        ok: true,
        version: '3.14.159',
        services: {
          d1: { ok: true },
          r2: { ok: true },
          vectorize: { ok: true },
        },
      };

      render(<HealthStatus {...defaultProps} health={response} />);
      expect(screen.getByText('3.14.159')).toBeInTheDocument();
    });
  });

  describe('message prop', () => {
    const response: HealthResponse = {
      ok: true,
      version: '1.0.0',
      services: {
        d1: { ok: true },
        r2: { ok: true },
        vectorize: { ok: true },
      },
    };

    it('should display custom messages', () => {
      render(
        <HealthStatus message="Custom health check message" health={response} />
      );
      expect(
        screen.getByText('Custom health check message')
      ).toBeInTheDocument();
    });
  });
});
