import { useEffect, useState } from 'react';
import { auth, db, collection, getDocs, onAuthChange } from '../firebase';
import { toast } from 'sonner';
import Layout from './Layout';
import CreateAdminPage from '../pages/CreateAdmin';
import GalleryPage from '../pages/Gallery';
import BuyRicePage from '../pages/BuyRice';
import DashboardAnalytics from './DashboardAnalytics';

interface User {
  id?: string;
  email?: string;
  displayName?: string;
  role?: 'user' | 'admin';
  createdAt?: any;
}

interface AdminProps {
  currentEmail: string;
  onLogout: () => void;
}

export default function AdminPanel({ currentEmail, onLogout }: AdminProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'admins' | 'gallery' | 'buy-rice'>('dashboard');

  useEffect(() => {
    const fetchUsers = async (_uid: string) => {
      try {
        console.log('Fetching users from Firestore...');
        const snap = await getDocs(collection(db, 'users'));
        console.log('Snapshot received. Number of docs:', snap.docs.length);
        console.log('Docs:', snap.docs.map(d => ({ id: d.id, data: d.data() })));
        
        const data: User[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        console.log('Parsed users:', data);
        setUsers(data);
      } catch (error: any) {
        console.error('Failed to load users:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        toast.error(`Failed to load users: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    const currentUid = auth.currentUser?.uid;
    if (currentUid) {
      fetchUsers(currentUid);
      return;
    }

    const unsub = onAuthChange((user) => {
      if (user?.uid) {
        fetchUsers(user.uid);
        unsub();
      }
    });

    return () => unsub();
  }, []);

  const totalUsers = users.length;

  return (
    <Layout currentEmail={currentEmail} onLogout={onLogout} onPageChange={setCurrentPage} currentPage={currentPage}>
      {currentPage === 'dashboard' ? (
        <div className="container-fluid p-0">
          <h1 className="h3 mb-3">
            <strong>User Management</strong> Dashboard
          </h1>

          <DashboardAnalytics />

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="row">
              <div className="col-md-6 col-xl-3 d-flex mb-3">
                <div className="card flex-fill">
                  <div className="card-body py-4">
                    <div className="row">
                      <div className="col mt-0">
                        <h5 className="card-title">Total Users</h5>
                      </div>
                      <div className="col-auto">
                        <div className="stat text-primary">
                          <i className="align-middle" data-feather="users"></i>
                        </div>
                      </div>
                    </div>
                    <h1 className="mt-1 mb-3">{totalUsers}</h1>
                    <div className="mb-0">
                      <span className="text-success">
                        <i className="mdi mdi-arrow-bottom-right"></i> All Users
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="row">
              <div className="col-12 d-flex">
                <div className="card flex-fill">
                  <div className="card-header">
                    <h5 className="card-title mb-0">Users List</h5>
                  </div>
                  <table className="table table-hover my-0">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="text-center py-4">
                            No users found
                          </td>
                        </tr>
                      ) : (
                        users.map((user) => (
                          <tr key={user.id}>
                            <td>
                              <strong>{user.email}</strong>
                            </td>
                            <td>{user.displayName || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
        </div>
      ) : currentPage === 'admins' ? (
          <CreateAdminPage onNavigate={setCurrentPage} />
      ) : currentPage === 'gallery' ? (
        <GalleryPage currentEmail={currentEmail} />
      ) : (
        <BuyRicePage onNavigate={setCurrentPage} />
      )}
    </Layout>
  );
}
