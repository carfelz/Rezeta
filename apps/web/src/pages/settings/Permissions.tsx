import { Fragment, useMemo } from 'react'
import { canManageRole } from '@rezeta/shared'
import type {
  AccessLevel,
  ModuleKey,
  PermissionCatalogEntry,
  SectionKey,
  UserRole,
} from '@rezeta/shared'
import { usePermissionMatrix, useUpdatePermission } from '@/hooks/permissions/use-permissions'
import { useCan } from '@/hooks/use-can'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { Callout } from '@/components/ui'
import { permissionsStrings } from './strings'

const ROLE_COLUMNS: UserRole[] = ['assistant', 'doctor', 'admin', 'super_admin']
const ACCESS_LEVELS: AccessLevel[] = ['none', 'view', 'manage']
const SECTION_ORDER: SectionKey[] = ['clinical', 'admin']

/** Sentinel shown by the section bulk-apply select when its modules disagree. */
const MIXED = 'mixed' as const

function roleLabel(role: UserRole): string {
  switch (role) {
    case 'assistant':
      return permissionsStrings.roleAssistant
    case 'doctor':
      return permissionsStrings.roleDoctor
    case 'admin':
      return permissionsStrings.roleAdmin
    case 'super_admin':
      return permissionsStrings.roleSuperAdmin
  }
}

function levelLabel(level: AccessLevel): string {
  switch (level) {
    case 'none':
      return permissionsStrings.levelNone
    case 'view':
      return permissionsStrings.levelView
    case 'manage':
      return permissionsStrings.levelManage
  }
}

function levelTint(level: AccessLevel): string {
  switch (level) {
    case 'none':
      return 'bg-n-50 text-n-500'
    case 'view':
      return 'bg-warning-bg text-warning-text'
    case 'manage':
      return 'bg-success-bg text-success-text'
  }
}

function moduleLabel(key: ModuleKey): string {
  return permissionsStrings.moduleLabels[key]
}

function sectionLabel(section: SectionKey): string {
  return section === 'clinical' ? permissionsStrings.sectionClinical : permissionsStrings.sectionAdmin
}

const SELECT_CLASS = cn(
  'h-input-md px-2 text-sm font-sans rounded-sm border border-n-200 outline-none',
  'transition-border duration-fast focus:border-p-500',
  'disabled:bg-n-25 disabled:text-n-300 disabled:border-n-200 disabled:cursor-not-allowed',
)

export function Permissions(): JSX.Element {
  const canManage = useCan('permissions', 'manage')
  const { user } = useAuth()
  const { data, isLoading, isError } = usePermissionMatrix()
  const update = useUpdatePermission()

  const sections = useMemo(() => {
    if (!data) return []
    return SECTION_ORDER.map((section) => ({
      section,
      modules: data.modules.filter((m) => m.section === section),
    })).filter((s) => s.modules.length > 0)
  }, [data])

  function columnEditable(columnRole: UserRole): boolean {
    return canManage && user != null && canManageRole(user.role, columnRole)
  }

  function sectionSharedLevel(
    modules: PermissionCatalogEntry[],
    role: UserRole,
  ): AccessLevel | typeof MIXED {
    if (!data || modules.length === 0) return 'none'
    const levels = modules.map((m) => data.matrix[role][m.key])
    const [first, ...rest] = levels
    return rest.every((level) => level === first) ? first! : MIXED
  }

  // The API has NO section concept: applying a section stamps every module in it
  // via one PATCH each. Backend enforcement stays strictly per-module.
  async function applySection(section: SectionKey, role: UserRole, level: AccessLevel): Promise<void> {
    if (!data) return
    const modules = data.modules.filter((m) => m.section === section)
    await Promise.all(
      modules.map((m) => update.mutateAsync({ role, moduleKey: m.key, accessLevel: level })),
    )
  }

  if (isLoading) {
    return (
      <div>
        <h1 className="text-h1 mb-6">{permissionsStrings.pageTitle}</h1>
        <p className="text-body text-n-500">{permissionsStrings.loading}</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div>
        <h1 className="text-h1 mb-6">{permissionsStrings.pageTitle}</h1>
        <Callout variant="danger" icon={<i className="ph ph-warning" />}>
          {permissionsStrings.loadError}
        </Callout>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-h1 mb-6">{permissionsStrings.pageTitle}</h1>

      {!canManage && (
        <Callout variant="info" icon={<i className="ph ph-info" />} className="mb-4">
          {permissionsStrings.readOnlyNotice}
        </Callout>
      )}

      <div className="border border-n-200 rounded-md overflow-x-auto">
        <table className="w-full border-collapse bg-n-0">
          <thead>
            <tr>
              <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                {permissionsStrings.colModule}
              </th>
              {ROLE_COLUMNS.map((role) => (
                <th
                  key={role}
                  className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left"
                >
                  {roleLabel(role)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map(({ section, modules }) => (
              <Fragment key={section}>
                <tr className="bg-n-25">
                  <th
                    scope="row"
                    className={cn(
                      'relative pl-4 text-sm font-semibold text-n-800 px-4 py-2 text-left',
                      'before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5',
                      'before:bg-p-500 before:rounded-sm',
                    )}
                  >
                    {sectionLabel(section)}
                  </th>
                  {ROLE_COLUMNS.map((role) => {
                    const shared = sectionSharedLevel(modules, role)
                    const editable = columnEditable(role)
                    return (
                      <td key={role} className="px-4 py-2">
                        <select
                          aria-label={`${sectionLabel(section)} — ${roleLabel(role)} — ${permissionsStrings.sectionApplyAll}`}
                          value={shared}
                          disabled={!editable}
                          onChange={(e) => {
                            const value = e.target.value
                            if (value === MIXED) return
                            void applySection(section, role, value as AccessLevel)
                          }}
                          className={cn(SELECT_CLASS, shared !== MIXED && levelTint(shared))}
                        >
                          {ACCESS_LEVELS.map((level) => (
                            <option key={level} value={level}>
                              {levelLabel(level)}
                            </option>
                          ))}
                          {shared === MIXED && (
                            <option value={MIXED} disabled>
                              {permissionsStrings.levelMixed}
                            </option>
                          )}
                        </select>
                      </td>
                    )
                  })}
                </tr>
                {modules.map((m) => (
                  <tr key={m.key} className="hover:bg-n-25">
                    <td className="px-4 py-2 pl-8 text-sm text-n-700">{moduleLabel(m.key)}</td>
                    {ROLE_COLUMNS.map((role) => {
                      const level = data.matrix[role][m.key]
                      const editable = columnEditable(role)
                      return (
                        <td key={role} className="px-4 py-2">
                          <select
                            aria-label={`${moduleLabel(m.key)} — ${roleLabel(role)}`}
                            value={level}
                            disabled={!editable}
                            onChange={(e) =>
                              update.mutate({
                                role,
                                moduleKey: m.key,
                                accessLevel: e.target.value as AccessLevel,
                              })
                            }
                            className={cn(SELECT_CLASS, levelTint(level))}
                          >
                            {ACCESS_LEVELS.map((lvl) => (
                              <option key={lvl} value={lvl}>
                                {levelLabel(lvl)}
                              </option>
                            ))}
                          </select>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
