import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Briefcase, Database, Globe, Loader2, Plus } from 'lucide-react'
import { useUIStore } from '@/lib/store'
import { usePermissions } from '@/hooks/usePermissions'
import { edcService } from '@/lib/api/services/edcService'
import { Button } from '@/components/ui/button'
import { JobListPanel } from '@/components/jobs/JobListPanel'
import { BPNDiscoveryPanel } from '@/components/bpn/BPNDiscoveryPanel'
import { CatalogView } from '@/components/catalog/CatalogView'
import { OwnCatalogView } from '@/components/catalog/OwnCatalogView'
import { ConsumeWizard } from '@/components/consume/ConsumeWizard'
import { RegisterAssetPanel } from '@/components/assets/RegisterAssetPanel'
import { EDCDetailHeader } from '@/components/edc/EDCDetailHeader'
import { cn } from '@/lib/utils'
import type { CatalogDataset } from '@/lib/api/types'

type TabValue = 'jobs' | 'partner-catalog' | 'own-catalog' | 'register-asset'

interface SelectedPartner {
  bpn: string
  connectorUrl: string
}

interface ConsumeTarget {
  dataset: CatalogDataset
  offerId: string
  sourceTab: 'partner-catalog' | 'own-catalog'
}

const NAV_ITEMS: {
  value: TabValue
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { value: 'jobs', label: 'Jobs', icon: Briefcase },
  { value: 'partner-catalog', label: 'Partner Catalog', icon: Globe },
  { value: 'own-catalog', label: 'Own Catalog', icon: Database },
  { value: 'register-asset', label: 'Register Asset', icon: Plus },
]

export default function EDCDashboardPage() {
  const { edcId } = useParams<{ edcId: string }>()
  const setSelectedEDCId = useUIStore((s) => s.setSelectedEDCId)
  const { can } = usePermissions()

  const [activeTab, setActiveTab] = useState<TabValue>('jobs')
  const [selectedPartner, setSelectedPartner] = useState<SelectedPartner | null>(null)
  const [consumeTarget, setConsumeTarget] = useState<ConsumeTarget | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [prevEdcId, setPrevEdcId] = useState<string>()

  if (edcId !== prevEdcId) {
    setPrevEdcId(edcId)
    setSelectedPartner(null)
  }

  useEffect(() => {
    setSelectedEDCId(edcId ?? null)
    return () => setSelectedEDCId(null)
  }, [edcId, setSelectedEDCId])

  const { data: edc, isLoading, isError } = useQuery({
    queryKey: ['edcs', edcId],
    queryFn: () => edcService.get(edcId!),
    enabled: !!edcId,
  })

  if (!edcId) {
    return <p className="text-sm text-muted-foreground">No EDC selected.</p>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError || !edc) {
    return <p className="text-sm text-destructive">Failed to load EDC details.</p>
  }

  const canStatus = can('edc', edcId, 'status')
  const canCatalog = can('edc', edcId, 'catalog')
  const canBpnDiscovery = can('edc', edcId, 'bpn-discovery')
  const canConsume = can('edc', edcId, 'consume')
  const canCreateAsset = can('edc', edcId, 'create_asset')

  const showJobs = canStatus
  const showPartnerCatalog = canCatalog && canBpnDiscovery
  const showOwnCatalog = canCatalog
  const showRegisterAsset = canCreateAsset

  function resolveDefaultTab(): TabValue {
    if (showJobs) return 'jobs'
    if (showPartnerCatalog) return 'partner-catalog'
    if (showOwnCatalog) return 'own-catalog'
    if (showRegisterAsset) return 'register-asset'
    return 'jobs'
  }

  const tabVisible: Record<TabValue, boolean> = {
    jobs: showJobs,
    'partner-catalog': showPartnerCatalog,
    'own-catalog': showOwnCatalog,
    'register-asset': showRegisterAsset,
  }

  const effectiveTab: TabValue = tabVisible[activeTab] ? activeTab : resolveDefaultTab()

  function handlePartnerSelected(bpn: string, connectorUrl: string) {
    setSelectedPartner({ bpn, connectorUrl })
  }

  function openConsumeWizard(
    dataset: CatalogDataset,
    offerId: string,
    sourceTab: 'partner-catalog' | 'own-catalog',
  ) {
    setConsumeTarget({ dataset, offerId, sourceTab })
    setWizardOpen(true)
  }

  function handleWizardClose() {
    setWizardOpen(false)
    setConsumeTarget(null)
  }

  function handleCreateAssetSuccess() {
    setActiveTab('jobs')
  }

  const partnerWizardOpen = wizardOpen && consumeTarget?.sourceTab === 'partner-catalog'
  const ownWizardOpen = wizardOpen && consumeTarget?.sourceTab === 'own-catalog'

  return (
    <div className="flex flex-col gap-4 h-full">
      <EDCDetailHeader edc={edc} />

      <div className="flex gap-0 flex-1 min-h-0">
        {/* Vertical navigation */}
        <nav className="flex flex-col gap-0.5 w-48 shrink-0 pr-4 border-r border-border">
          {NAV_ITEMS.map(({ value, label, icon: Icon }) => {
            if (!tabVisible[value]) return null
            const isActive = effectiveTab === value
            return (
              <button
                key={value}
                onClick={() => setActiveTab(value)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left w-full',
                  isActive
                    ? 'bg-accent text-accent-foreground font-semibold'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </button>
            )
          })}
        </nav>

        {/* Tab content */}
        <div className="flex-1 min-w-0 pl-6 overflow-y-auto">
          {effectiveTab === 'jobs' && showJobs && (
            <JobListPanel edcId={edcId} />
          )}

          {effectiveTab === 'partner-catalog' && showPartnerCatalog && (
            <div>
              {selectedPartner === null ? (
                <BPNDiscoveryPanel
                  edcId={edcId}
                  onPartnerSelected={handlePartnerSelected}
                />
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPartner(null)}
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Back to discovery
                    </Button>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{selectedPartner.bpn}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {selectedPartner.connectorUrl}
                      </span>
                    </div>
                  </div>
                  <CatalogView
                    edcId={edcId}
                    providerBpn={selectedPartner.bpn}
                    providerDspUrl={selectedPartner.connectorUrl}
                    onConsumeAsset={(dataset, offerId) =>
                      openConsumeWizard(dataset, offerId, 'partner-catalog')
                    }
                    canConsume={canConsume}
                  />
                </div>
              )}

              <ConsumeWizard
                dataset={partnerWizardOpen ? (consumeTarget?.dataset ?? null) : null}
                edcId={edcId}
                providerBpn={selectedPartner?.bpn ?? ''}
                providerDspUrl={selectedPartner?.connectorUrl ?? ''}
                open={partnerWizardOpen}
                onClose={handleWizardClose}
              />
            </div>
          )}

          {effectiveTab === 'own-catalog' && showOwnCatalog && (
            <div>
              <OwnCatalogView
                edcId={edcId}
                onConsumeAsset={(dataset, offerId) =>
                  openConsumeWizard(dataset, offerId, 'own-catalog')
                }
                canConsume={canConsume}
                canDelete={canCreateAsset}
              />

              <ConsumeWizard
                dataset={ownWizardOpen ? (consumeTarget?.dataset ?? null) : null}
                edcId={edcId}
                providerBpn={edc.provider_bpn}
                providerDspUrl={''}
                open={ownWizardOpen}
                onClose={handleWizardClose}
              />
            </div>
          )}

          {effectiveTab === 'register-asset' && showRegisterAsset && (
            <RegisterAssetPanel edcId={edcId} onSuccess={handleCreateAssetSuccess} />
          )}
        </div>
      </div>
    </div>
  )
}
