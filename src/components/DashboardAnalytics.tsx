import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { auth } from '../firebase';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type AnalyticsResponse = {
  success: boolean;
  days: number;
  usersTotal: number;
  usersByDay: Record<string, number>;
  paymentsTotal: number;
  paymentsByDay: Record<string, number>;
};

export default function DashboardAnalytics() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const backendUrl = useMemo(() => {
    return (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:3001';
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const user = auth.currentUser;
        if (!user) {
          setError('Not authenticated');
          return;
        }

        const token = await user.getIdToken();
        const response = await fetch(`${backendUrl}/api/analytics?days=14`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = (await response.json()) as AnalyticsResponse & { message?: string };
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || 'Failed to load analytics');
        }

        setData(payload);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to load analytics';
        setError(message);
      } finally {
        setLoading(false);
      }
    })();
  }, [backendUrl]);

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-warning mb-0">{error}</div>;
  }

  if (!data) return null;

  const labels = Object.keys(data.usersByDay);
  const usersSeries = labels.map((k) => data.usersByDay[k] ?? 0);
  const paymentsSeries = labels.map((k) => data.paymentsByDay[k] ?? 0);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Users',
        data: usersSeries,
        borderColor: 'rgb(13, 110, 253)',
        backgroundColor: 'rgba(13, 110, 253, 0.15)',
        tension: 0.25,
        fill: false,
      },
      {
        label: 'Payments',
        data: paymentsSeries,
        borderColor: 'rgb(25, 135, 84)',
        backgroundColor: 'rgba(25, 135, 84, 0.15)',
        tension: 0.25,
        fill: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  } as const;

  return (
    <div className="row">
      <div className="col-12 col-xl-4 d-flex mb-3">
        <div className="card flex-fill">
          <div className="card-body">
            <h5 className="card-title">Totals</h5>
            <div className="mb-2">Users: <strong>{data.usersTotal}</strong></div>
            <div>Payments total: <strong>${Number(data.paymentsTotal || 0).toFixed(2)}</strong></div>
          </div>
        </div>
      </div>
      <div className="col-12 col-xl-8 d-flex mb-3">
        <div className="card flex-fill">
          <div className="card-body">
            <h5 className="card-title">Last 14 days</h5>
            <div style={{ height: 260 }}>
              <Line data={chartData} options={options} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
