import { Badge } from "@/components/ui/badge";
import type { UserPermissions } from "@/api/users";

interface PermissionBadgesProps {
  permissions?: UserPermissions;
}

export function PermissionBadges({ permissions }: PermissionBadgesProps) {
  if (!permissions) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {permissions.canCreateAgents && (
        <Badge variant="outline" className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20">
          Criar agentes
        </Badge>
      )}
      {permissions.canCreateChannels && (
        <Badge variant="outline" className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20">
          Criar canais
        </Badge>
      )}
    </div>
  );
}
