import { useReducer, useEffect } from 'react'
import type { CatalogDataset } from '@/lib/api/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Step1AssetReview } from '@/components/consume/steps/Step1_AssetReview'
import { Step2PolicyConfirm } from '@/components/consume/steps/Step2_PolicyConfirm'
import { Step3Options } from '@/components/consume/steps/Step3_Options'
import { Step4Submit } from '@/components/consume/steps/Step4_Submit'
import { JobProgressPanel } from '@/components/consume/JobProgressPanel'

interface ConsumeWizardProps {
  dataset: CatalogDataset | null
  edcId: string
  providerBpn: string
  providerDspUrl: string
  open: boolean
  onClose: () => void
}

interface WizardState {
  step: 1 | 2 | 3 | 4 | 5
  policyChecked: boolean
  options: { debug: boolean }
  jobId: string | null
}

type WizardAction =
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'SET_OPTIONS'; options: { debug: boolean } }
  | { type: 'JOB_CREATED'; jobId: string }
  | { type: 'RESET' }

const initialState: WizardState = {
  step: 1,
  policyChecked: false,
  options: { debug: false },
  jobId: null,
}

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'NEXT': {
      const next = (state.step + 1) as WizardState['step']
      return { ...state, step: next > 5 ? 5 : next }
    }
    case 'BACK': {
      const prev = (state.step - 1) as WizardState['step']
      return { ...state, step: prev < 1 ? 1 : prev }
    }
    case 'SET_OPTIONS':
      return { ...state, options: action.options }
    case 'JOB_CREATED':
      return { ...state, step: 5, jobId: action.jobId }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

const STEP_TITLES: Record<number, string> = {
  1: 'Review Asset',
  2: 'Confirm Policy',
  3: 'Configure Options',
  4: 'Confirm & Submit',
  5: 'Job Progress',
}

function StepDots({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[1, 2, 3, 4].map((step) => (
        <div
          key={step}
          className={[
            'h-2 w-2 rounded-full transition-colors',
            current === step
              ? 'bg-primary'
              : current > step
                ? 'bg-primary/40'
                : 'bg-muted-foreground/30',
          ].join(' ')}
        />
      ))}
    </div>
  )
}

export function ConsumeWizard({
  dataset,
  edcId,
  providerBpn,
  providerDspUrl,
  open,
  onClose,
}: ConsumeWizardProps) {
  const [state, dispatch] = useReducer(wizardReducer, initialState)

  // Reset state when dialog is closed
  useEffect(() => {
    if (!open) {
      dispatch({ type: 'RESET' })
    }
  }, [open])

  function handleClose() {
    dispatch({ type: 'RESET' })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <DialogContent
        className={state.step === 5 ? 'w-[min(860px,90vw)] sm:max-w-none' : 'sm:max-w-lg'}
        showCloseButton={state.step !== 5}
      >
        <DialogHeader>
          <DialogTitle>{STEP_TITLES[state.step]}</DialogTitle>
          <DialogDescription className="sr-only">
            Consume asset wizard — step {state.step} of 4
          </DialogDescription>
          {state.step < 5 && <StepDots current={state.step} />}
        </DialogHeader>

        {!dataset ? null : state.step === 5 ? (
          <JobProgressPanel
            jobId={state.jobId}
            edcId={edcId}
            onClose={handleClose}
          />
        ) : state.step === 1 ? (
          <Step1AssetReview
            dataset={dataset}
            onNext={() => dispatch({ type: 'NEXT' })}
            onCancel={handleClose}
          />
        ) : state.step === 2 ? (
          <Step2PolicyConfirm
            dataset={dataset}
            onNext={() => dispatch({ type: 'NEXT' })}
            onBack={() => dispatch({ type: 'BACK' })}
          />
        ) : state.step === 3 ? (
          <Step3Options
            edcId={edcId}
            providerBpn={providerBpn}
            providerDspUrl={providerDspUrl}
            options={state.options}
            onChange={(opts) => dispatch({ type: 'SET_OPTIONS', options: opts })}
            onNext={() => dispatch({ type: 'NEXT' })}
            onBack={() => dispatch({ type: 'BACK' })}
          />
        ) : (
          <Step4Submit
            dataset={dataset}
            edcId={edcId}
            providerBpn={providerBpn}
            providerDspUrl={providerDspUrl}
            options={state.options}
            onJobCreated={(jobId) => dispatch({ type: 'JOB_CREATED', jobId })}
            onBack={() => dispatch({ type: 'BACK' })}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
