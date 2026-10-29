import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

interface ConsumeOptions {
  debug: boolean
}

interface Step3OptionsProps {
  edcId: string
  providerBpn: string
  providerDspUrl: string
  options: ConsumeOptions
  onChange: (opts: ConsumeOptions) => void
  onNext: () => void
  onBack: () => void
}

export function Step3Options({
  providerBpn,
  providerDspUrl,
  options,
  onChange,
  onNext,
  onBack,
}: Step3OptionsProps) {
  function handleDebugChange(checked: boolean | 'indeterminate') {
    onChange({ ...options, debug: checked === true })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Read-only provider info */}
      <div className="flex flex-col gap-3">
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground">Provider BPN</p>
          <p className="text-sm font-mono break-all">{providerBpn}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground">Provider DSP URL</p>
          <p className="text-sm font-mono break-all">{providerDspUrl}</p>
        </div>
      </div>

      <Separator />

      {/* Options */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Options
        </p>

        <div className="flex items-center gap-3">
          <Checkbox
            id="debug-mode"
            checked={options.debug}
            onCheckedChange={handleDebugChange}
          />
          <div className="flex flex-col">
            <Label htmlFor="debug-mode" className="cursor-pointer">
              Debug mode
            </Label>
            <p className="text-xs text-muted-foreground">
              Enable verbose logging in the workflow execution
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Next</Button>
      </div>
    </div>
  )
}
