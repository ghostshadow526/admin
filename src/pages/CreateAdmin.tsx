import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { auth } from '../firebase';

interface AdminPageProps {
	onNavigate?: (page: 'dashboard' | 'admins' | 'gallery') => void;
}

export default function CreateAdminPage({ onNavigate }: AdminPageProps) {
	const [email, setEmail] = useState('');
	const [displayName, setDisplayName] = useState('');
	const [password, setPassword] = useState('');
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();

		if (!email || !displayName || !password) {
			toast.error('Please fill in all fields');
			return;
		}

		if (password.length < 6) {
			toast.error('Password must be at least 6 characters');
			return;
		}

		try {
			setSubmitting(true);

			const user = auth.currentUser;
			if (!user) {
				toast.error('Not authenticated');
				return;
			}
			const token = await user.getIdToken();

			const backendUrl = (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:3001';
			const response = await fetch(`${backendUrl}/api/create-admin`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ email, password, displayName }),
			});

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data?.message || 'Failed to create admin');
			}

			toast.success(`Admin ${email} created successfully`);
			setEmail('');
			setDisplayName('');
			setPassword('');
		} catch (error: any) {
			console.error('Admin creation failed:', error);
			toast.error(error?.message || 'Failed to create admin');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="container-fluid p-0">
			<div className="d-flex justify-content-between align-items-center mb-3">
				<h1 className="h3 mb-0">
					<strong>Create</strong> Admin
				</h1>
				<button onClick={() => onNavigate?.('dashboard')} className="btn btn-outline-secondary">
					← Back to Dashboard
				</button>
			</div>

			<div className="card">
				<div className="card-header">
					<h5 className="card-title mb-0">Create New Admin Account</h5>
				</div>
				<div className="card-body">
					<form onSubmit={handleSubmit}>
						<div className="mb-3">
							<label className="form-label">Email</label>
							<input
								type="email"
								className="form-control"
								placeholder="admin@example.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
							/>
						</div>

						<div className="mb-3">
							<label className="form-label">Display Name</label>
							<input
								type="text"
								className="form-control"
								placeholder="Admin Name"
								value={displayName}
								onChange={(e) => setDisplayName(e.target.value)}
								required
							/>
						</div>

						<div className="mb-3">
							<label className="form-label">Password</label>
							<input
								type="password"
								className="form-control"
								placeholder="Enter a secure password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
							/>
						</div>

						<button type="submit" disabled={submitting} className="btn btn-primary w-100">
							{submitting ? 'Creating...' : 'Create Admin Account'}
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}
