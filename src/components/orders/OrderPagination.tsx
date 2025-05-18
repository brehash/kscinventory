import React from 'react';
import ReactPaginate from 'react-paginate';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface OrderPaginationProps {
  currentPage: number;
  pageCount: number;
  itemsPerPage: number;
  totalOrders: number;
  handlePageClick: (event: { selected: number }) => void;
}

const OrderPagination: React.FC<OrderPaginationProps> = ({
  currentPage,
  pageCount,
  itemsPerPage,
  totalOrders,
  handlePageClick
}) => {
  if (pageCount <= 1) return null;
  
  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
      <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div className="flex-1 flex justify-between sm:hidden">
          <button
            onClick={() => handlePageClick({ selected: Math.max(0, currentPage - 1) })}
            disabled={currentPage === 0}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => handlePageClick({ selected: Math.min(pageCount - 1, currentPage + 1) })}
            disabled={currentPage === pageCount - 1}
            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{totalOrders > 0 ? currentPage * itemsPerPage + 1 : 0}</span> to{' '}
              <span className="font-medium">
                {Math.min((currentPage + 1) * itemsPerPage, totalOrders)}
              </span>{' '}
              of <span className="font-medium">{totalOrders}</span> orders
            </p>
          </div>
          <div>
            <ReactPaginate
              previousLabel={<ChevronLeft className="h-5 w-5" />}
              nextLabel={<ChevronRight className="h-5 w-5" />}
              breakLabel="..."
              breakClassName="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
              pageCount={pageCount}
              marginPagesDisplayed={2}
              pageRangeDisplayed={5}
              onPageChange={handlePageClick}
              containerClassName="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
              pageClassName="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              previousClassName="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              nextClassName="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              activeClassName="z-10 bg-indigo-50 border-indigo-500 text-indigo-600"
              forcePage={currentPage}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderPagination;