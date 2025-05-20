import React from 'react';

interface CustomFieldsGroup {
  category: string;
  icon: React.ReactNode;
  fields: Array<{ id: string; name: string; description?: string }>;
}

interface CustomReportsFieldSelectorProps {
  fieldsGroups: CustomFieldsGroup[];
  selectedFields: string[];
  onToggleField: (fieldId: string) => void;
  searchQuery?: string;
}

/**
 * Component for selecting fields in custom reports
 * Provides a grouped, searchable interface with checkboxes
 */
const CustomReportsFieldSelector: React.FC<CustomReportsFieldSelectorProps> = ({
  fieldsGroups,
  selectedFields,
  onToggleField,
  searchQuery = ''
}) => {
  // Filter fields based on search query
  const filteredGroups = fieldsGroups.map(group => ({
    ...group,
    fields: group.fields.filter(field => 
      searchQuery 
        ? field.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (field.description && field.description.toLowerCase().includes(searchQuery.toLowerCase()))
        : true
    )
  })).filter(group => group.fields.length > 0);

  return (
    <div className="space-y-4">
      {filteredGroups.map(group => (
        <div key={group.category} className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-indigo-500">{group.icon}</div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase">{group.category} Fields</h4>
          </div>
          
          <div className="space-y-1 border border-gray-200 rounded-md p-2 bg-gray-50">
            {group.fields.map(field => (
              <div key={field.id} className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id={field.id}
                    type="checkbox"
                    checked={selectedFields.includes(field.id)}
                    onChange={() => onToggleField(field.id)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-2 text-sm">
                  <label htmlFor={field.id} className="font-medium text-gray-700">
                    {field.name}
                  </label>
                  {field.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{field.description}</p>
                  )}
                </div>
              </div>
            ))}
            
            {group.fields.length === 0 && (
              <div className="text-xs text-gray-500 italic p-1">No matching fields in this category</div>
            )}
          </div>
        </div>
      ))}
      
      {filteredGroups.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-4">
          No fields match your search criteria
        </div>
      )}
    </div>
  );
};

export default CustomReportsFieldSelector;