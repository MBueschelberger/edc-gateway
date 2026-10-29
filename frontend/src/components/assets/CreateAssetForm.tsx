import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { consumeService } from '@/lib/api/services/consumeService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { BPNPickerField } from '@/components/assets/BPNPicker'

const schema = z.object({
  asset_name: z.string().min(1, 'Asset name is required'),
  asset_description: z.string().optional(),
  asset_type: z.string().optional(),
  asset_path: z.string().url('Must be a valid HTTPS URL').refine(
    (v) => v.startsWith('https://'),
    'Must be an HTTPS URL'
  ),
  consumer_bpn: z.string().min(1, 'Consumer BPN is required'),
  full_policy: z.boolean(),
  asset_id_short: z.string().optional(),
  data_address_base_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  data_address_name: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface CreateAssetFormProps {
  edcId: string
  onSuccess: (jobId: string) => void
}

export function CreateAssetForm({ edcId, onSuccess }: CreateAssetFormProps) {
  "use no memo"
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      asset_type: 'application/json',
      full_policy: false,
      consumer_bpn: '',
    },
  })

  const fullPolicy = watch('full_policy')
  const consumerBpn = watch('consumer_bpn')

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      consumeService.createAsset(edcId, {
        asset_name: data.asset_name,
        asset_description: data.asset_description || undefined,
        asset_type: data.asset_type || undefined,
        asset_path: data.asset_path,
        consumer_bpn: data.consumer_bpn,
        full_policy: data.full_policy,
        asset_id_short: data.asset_id_short || undefined,
        data_address_base_url: data.data_address_base_url || undefined,
        data_address_name: data.data_address_name || undefined,
      }),
    onSuccess: (job) => {
      onSuccess(job.id)
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to create asset'
      toast.error(message)
    },
  })

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asset_name">Asset Name *</Label>
        <Input id="asset_name" {...register('asset_name')} placeholder="My Asset" />
        {errors.asset_name && (
          <p className="text-xs text-destructive">{errors.asset_name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asset_description">Asset Description</Label>
        <Textarea
          id="asset_description"
          {...register('asset_description')}
          placeholder="Optional description"
          rows={3}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asset_type">Asset Type</Label>
        <Input
          id="asset_type"
          {...register('asset_type')}
          placeholder="application/json"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asset_path">Asset Path (HTTPS URL) *</Label>
        <Input
          id="asset_path"
          {...register('asset_path')}
          placeholder="https://example.com/path/to/asset"
        />
        {errors.asset_path && (
          <p className="text-xs text-destructive">{errors.asset_path.message}</p>
        )}
      </div>

      <BPNPickerField
        edcId={edcId}
        value={consumerBpn}
        onChange={(bpn) => setValue('consumer_bpn', bpn, { shouldValidate: true })}
        error={errors.consumer_bpn?.message}
      />

      <div className="flex items-center gap-2">
        <Checkbox
          id="full_policy"
          checked={fullPolicy}
          onCheckedChange={(checked) => setValue('full_policy', checked === true)}
        />
        <Label htmlFor="full_policy" className="cursor-pointer">
          Full Policy
        </Label>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asset_id_short">Asset ID Short</Label>
        <Input
          id="asset_id_short"
          {...register('asset_id_short')}
          placeholder="Optional short identifier"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="data_address_base_url">Data Address Base URL</Label>
        <Input
          id="data_address_base_url"
          {...register('data_address_base_url')}
          placeholder="https://..."
        />
        {errors.data_address_base_url && (
          <p className="text-xs text-destructive">{errors.data_address_base_url.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="data_address_name">Data Address Name</Label>
        <Input
          id="data_address_name"
          {...register('data_address_name')}
          placeholder="Optional data address name"
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Asset
        </Button>
      </div>
    </form>
  )
}
