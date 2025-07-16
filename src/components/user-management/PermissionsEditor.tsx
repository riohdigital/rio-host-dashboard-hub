import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { PERMISSION_CATEGORIES } from '@/types/user-management';
import type { UserPermission, PermissionType } from '@/types/user-management';

interface PermissionsEditorProps {
  permissions: UserPermission[];
  onChange: (permissions: UserPermission[]) => void;
  userRole: string;
}

const PermissionsEditor: React.FC<PermissionsEditorProps> = ({
  permissions,
  onChange,
  userRole
}) => {
  const hasPermission = (permissionType: PermissionType): boolean => {
    const permission = permissions.find(p => 
      p.permission_type === permissionType && !p.resource_id
    );
    return permission?.permission_value || false;
  };

  const updatePermission = (permissionType: PermissionType, value: boolean) => {
    const newPermissions = [...permissions];
    const existingIndex = newPermissions.findIndex(p => 
      p.permission_type === permissionType && !p.resource_id
    );

    if (existingIndex >= 0) {
      newPermissions[existingIndex] = {
        ...newPermissions[existingIndex],
        permission_value: value
      };
    } else {
      newPermissions.push({
        id: '', // Será gerado pelo banco
        user_id: '', // Será definido ao salvar
        permission_type: permissionType,
        permission_value: value,
        created_at: new Date().toISOString()
      });
    }

    onChange(newPermissions);
  };

  // Usuário mestre não pode ter permissões editadas
  if (userRole === 'master') {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Usuário mestre possui todas as permissões automaticamente.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {PERMISSION_CATEGORIES.map((category) => (
        <div key={category.name} className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-foreground">
              {category.label}
            </h4>
            <p className="text-xs text-muted-foreground">
              Permissões relacionadas a {category.label.toLowerCase()}
            </p>
          </div>
          
          <div className="space-y-3">
            {category.permissions.map((permission) => (
              <div key={permission.type} className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label 
                    htmlFor={permission.type}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {permission.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {permission.description}
                  </p>
                </div>
                <Switch
                  id={permission.type}
                  checked={hasPermission(permission.type)}
                  onCheckedChange={(checked) => updatePermission(permission.type, checked)}
                />
              </div>
            ))}
          </div>
          
          {category.name !== 'system' && <Separator />}
        </div>
      ))}
    </div>
  );
};

export default PermissionsEditor;