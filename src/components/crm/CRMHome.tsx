import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Client, Order } from '../../types';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  UserPlus, 
  Building,
  ShoppingBag,
  CalendarClock,
  UserX,
  PieChart,
  BarChart
} from 'lucide-react';
import ClientCard from './ClientCard';

const CRMHome: React.FC = () => {
  const navigate = useNavigate();
  
  // State for clients and orders
  const [topClients, setTopClients] = useState<Client[]>([]);
  const [recentClients, setRecentClients] = useState<Client[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dashboard statistics
  const [stats, setStats] = useState({
    totalClients: 0,
    activeClients: 0,
    inactiveClients: 0,
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0
  });
  
  useEffect(() => {
    const fetchCRMData = async () => {
      try {
        setLoading(true);
        
        // Fetch clients count
        const clientsRef = collection(db, 'clients');
        const clientsSnapshot = await getDocs(clientsRef);
        
        // Calculate client stats
        const allClients = clientsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Client));
        
        const activeClients = allClients.filter(client => client.isActive);
        const inactiveClients = allClients.filter(client => !client.isActive);
        
        // Fetch top clients by total spent
        const topClientsQuery = query(
          clientsRef,
          orderBy('totalSpent', 'desc'),
          limit(4)
        );
        const topClientsSnapshot = await getDocs(topClientsQuery);
        
        const topClientsData = topClientsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            lastOrderDate: data.lastOrderDate?.toDate(),
          } as Client;
        });
        
        setTopClients(topClientsData);
        
        // Fetch recent clients
        const recentClientsQuery = query(
          clientsRef,
          orderBy('createdAt', 'desc'),
          limit(4)
        );
        const recentClientsSnapshot = await getDocs(recentClientsQuery);
        
        const recentClientsData = recentClientsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            lastOrderDate: data.lastOrderDate?.toDate(),
          } as Client;
        });
        
        setRecentClients(recentClientsData);
        
        // Fetch recent orders
        const ordersRef = collection(db, 'orders');
        const recentOrdersQuery = query(
          ordersRef,
          orderBy('orderDate', 'desc'),
          limit(5)
        );
        const recentOrdersSnapshot = await getDocs(recentOrdersQuery);
        
        const recentOrdersData = recentOrdersSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            orderDate: data.orderDate?.toDate() || new Date(),
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            lastOrderDate: data.lastOrderDate?.toDate(),
          } as Order;
        });
        
        setRecentOrders(recentOrdersData);
        
        // Calculate total orders and revenue
        const totalOrders = allClients.reduce((sum, client) => sum + client.totalOrders, 0);
        const totalRevenue = allClients.reduce((sum, client) => sum + client.totalSpent, 0);
        
        // Set statistics
        setStats({
          totalClients: allClients.length,
          activeClients: activeClients.length,
          inactiveClients: inactiveClients.length,
          totalOrders,
          totalRevenue,
          averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0
        });
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching CRM data:', err);
        setError('Failed to load CRM dashboard data');
        setLoading(false);
      }
    };
    
    fetchCRMData();
  }, []);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm leading-5 text-red-700">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Client Relationship Management</h1>
        <p className="text-sm text-gray-600 mt-1">Overview of your client relationships and sales performance</p>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white overflow-hidden rounded-lg shadow-sm">
          <div className="p-5">
            <div className="flex items-center">
              <div className="bg-indigo-100 rounded-md p-3 flex-shrink-0">
                <Users className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Clients</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">{stats.totalClients}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <Link to="/crm/clients" className="font-medium text-indigo-600 hover:text-indigo-500">View all clients</Link>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden rounded-lg shadow-sm">
          <div className="p-5">
            <div className="flex items-center">
              <div className="bg-blue-100 rounded-md p-3 flex-shrink-0">
                <ShoppingBag className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Orders</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">{stats.totalOrders}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <Link to="/orders" className="font-medium text-indigo-600 hover:text-indigo-500">View all orders</Link>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden rounded-lg shadow-sm">
          <div className="p-5">
            <div className="flex items-center">
              <div className="bg-green-100 rounded-md p-3 flex-shrink-0">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Revenue</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">{stats.totalRevenue.toLocaleString()} RON</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <Link to="/orders" className="font-medium text-indigo-600 hover:text-indigo-500">View sales details</Link>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden rounded-lg shadow-sm">
          <div className="p-5">
            <div className="flex items-center">
              <div className="bg-amber-100 rounded-md p-3 flex-shrink-0">
                <TrendingUp className="h-6 w-6 text-amber-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Avg. Order Value</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">
                      {stats.averageOrderValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} RON
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <Link to="/orders" className="font-medium text-indigo-600 hover:text-indigo-500">View order details</Link>
            </div>
          </div>
        </div>
      </div>
      
      {/* Client Distribution & Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {/* Client Status Distribution */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <PieChart className="h-5 w-5 text-indigo-500 mr-2" />
            Client Status Distribution
          </h2>
          
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="inline-block h-3 w-3 rounded-full bg-green-500 mr-2"></span>
                <span className="text-sm text-gray-600">Active Clients</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900">{stats.activeClients}</span>
                <span className="text-xs text-gray-500">
                  ({stats.totalClients > 0 ? Math.round((stats.activeClients / stats.totalClients) * 100) : 0}%)
                </span>
              </div>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full" 
                style={{ width: `${stats.totalClients > 0 ? (stats.activeClients / stats.totalClients) * 100 : 0}%` }}
              ></div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="inline-block h-3 w-3 rounded-full bg-red-500 mr-2"></span>
                <span className="text-sm text-gray-600">Inactive Clients</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900">{stats.inactiveClients}</span>
                <span className="text-xs text-gray-500">
                  ({stats.totalClients > 0 ? Math.round((stats.inactiveClients / stats.totalClients) * 100) : 0}%)
                </span>
              </div>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-red-500 h-2 rounded-full" 
                style={{ width: `${stats.totalClients > 0 ? (stats.inactiveClients / stats.totalClients) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <Link 
              to="/crm/clients"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              View all clients
            </Link>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm flex flex-col">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">
            Quick Actions
          </h2>
          
          <div className="space-y-3 flex-grow">
            <button
              onClick={() => navigate('/crm/clients/new')}
              className="inline-flex w-full items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add New Client
            </button>
            
            <button
              onClick={() => navigate('/orders/new')}
              className="inline-flex w-full items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
            >
              <ShoppingBag className="h-4 w-4 mr-2" />
              Create New Order
            </button>
            
            <Link
              to="/crm/clients"
              className="inline-flex w-full items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              <Users className="h-4 w-4 mr-2" />
              View All Clients
            </Link>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Managing your client relationships effectively can increase sales and retention.
            </p>
          </div>
        </div>
        
        {/* Active vs Inactive */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <BarChart className="h-5 w-5 text-indigo-500 mr-2" />
            Client Activity Overview
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-green-700">
                <UserPlus className="h-5 w-5 mr-2" />
                <span className="text-sm font-medium">Active Clients</span>
              </div>
              <span className="text-lg font-bold text-gray-900">{stats.activeClients}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center text-red-700">
                <UserX className="h-5 w-5 mr-2" />
                <span className="text-sm font-medium">Inactive Clients</span>
              </div>
              <span className="text-lg font-bold text-gray-900">{stats.inactiveClients}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center text-blue-700">
                <CalendarClock className="h-5 w-5 mr-2" />
                <span className="text-sm font-medium">Activity Ratio</span>
              </div>
              <span className="text-lg font-bold text-gray-900">
                {stats.totalClients > 0 ? Math.round((stats.activeClients / stats.totalClients) * 100) : 0}%
              </span>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-green-600 bg-green-200">
                    Active Rate
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block text-green-600">
                    {stats.totalClients > 0 ? Math.round((stats.activeClients / stats.totalClients) * 100) : 0}%
                  </span>
                </div>
              </div>
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200">
                <div 
                  style={{ width: `${stats.totalClients > 0 ? (stats.activeClients / stats.totalClients) * 100 : 0}%` }} 
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Top Clients and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Top Clients */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center">
              <DollarSign className="h-5 w-5 text-indigo-500 mr-2" />
              Top Clients by Revenue
            </h2>
            <Link 
              to="/crm/clients"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              View all
            </Link>
          </div>
          
          {topClients.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Building className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-gray-900">No clients yet</h3>
              <p className="mt-1 text-xs text-gray-500">Start adding clients to see top performers</p>
            </div>
          ) : (
            <div className="space-y-4">
              {topClients.map((client, index) => (
                <div 
                  key={client.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/crm/clients/${client.id}`)}
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0 mr-3">
                      <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-500 font-semibold">
                        {index + 1}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">{client.name}</h3>
                      <p className="text-xs text-gray-500">
                        {client.totalOrders} orders • {client.companyName || 'Individual'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{client.totalSpent.toLocaleString()} RON</p>
                    <p className="text-xs text-gray-500">
                      Avg: {(client.totalSpent / (client.totalOrders || 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })} RON
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Recent Clients */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center">
              <Users className="h-5 w-5 text-indigo-500 mr-2" />
              Recently Added Clients
            </h2>
            <Link 
              to="/crm/clients"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              View all
            </Link>
          </div>
          
          {recentClients.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-gray-900">No clients yet</h3>
              <p className="mt-1 text-xs text-gray-500">Start adding clients to your CRM</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentClients.map(client => (
                <div 
                  key={client.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/crm/clients/${client.id}`)}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mr-3">
                      <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">{client.name}</h3>
                      <p className="text-xs text-gray-500">
                        {client.companyName || 'Individual'} • {client.email || 'No email'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      client.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {client.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CRMHome;