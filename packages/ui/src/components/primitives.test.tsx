import { expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { Avatar, initials } from './avatar'
import { Button } from './button'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { Input } from './input'
import { Skeleton } from './skeleton'

test('Dialog opens from its trigger as a labelled, described modal', async () => {
  render(
    <Dialog>
      <DialogTrigger>Invite</DialogTrigger>
      <DialogContent>
        <DialogTitle>Invite a teammate</DialogTitle>
        <DialogDescription>They get an email with a sign-up link.</DialogDescription>
      </DialogContent>
    </Dialog>,
  )
  expect(screen.queryByRole('dialog')).toBeNull()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Invite' })))
  const dialog = await screen.findByRole('dialog')
  expect(dialog).toHaveAccessibleName('Invite a teammate')
  expect(dialog).toHaveAccessibleDescription('They get an email with a sign-up link.')
})

test('DropdownMenu opens and runs the chosen item', async () => {
  let picked = ''
  render(
    <DropdownMenu>
      <DropdownMenuTrigger>Team</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => (picked = 'settings')}>Settings</DropdownMenuItem>
        <DropdownMenuItem variant="danger" onClick={() => (picked = 'leave')}>
          Leave team
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  )
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Team' })))
  const leave = await screen.findByRole('menuitem', { name: 'Leave team' })
  expect(leave.dataset.variant).toBe('danger')
  await act(async () => fireEvent.click(leave))
  expect(picked).toBe('leave')
})

function Palette() {
  const [open, setOpen] = useState(true)
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command" />
      <CommandList>
        <CommandEmpty>No results</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem>Go to Home</CommandItem>
          <CommandItem>Go to Team settings</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

test('CommandDialog filters items and reports an empty result', async () => {
  render(<Palette />)
  expect(await screen.findByRole('dialog')).toHaveAccessibleName('Command palette')
  const input = screen.getByPlaceholderText('Type a command')
  await act(async () => fireEvent.change(input, { target: { value: 'team' } }))
  expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Go to Team settings'])
  await act(async () => fireEvent.change(input, { target: { value: 'zzz' } }))
  expect(screen.getByText('No results')).toBeInTheDocument()
})

test('Avatar shows initials named for the person when there is no image', () => {
  render(<Avatar name="Ana Lima" />)
  expect(screen.getByRole('img', { name: 'Ana Lima' }).textContent).toBe('AL')
  expect(initials('ana@team.dev')).toBe('A')
  expect(initials('  Bo  ')).toBe('B')
})

test('Input exposes the error state through aria-invalid', () => {
  render(<Input aria-label="Email" aria-invalid="true" defaultValue="nope" />)
  const input = screen.getByRole('textbox', { name: 'Email' })
  expect(input).toBeInvalid()
  expect(input.className).toContain('aria-invalid:border-danger')
})

test('Skeleton is hidden from assistive tech and does not animate', () => {
  const { container } = render(<Skeleton className="h-4 w-24" />)
  const el = container.firstElementChild as HTMLElement
  expect(el.getAttribute('aria-hidden')).toBe('true')
  expect(el.className).not.toMatch(/animate-/)
})

test('Button inside a form submits only when asked to', () => {
  let submits = 0
  render(
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submits++
      }}
    >
      <Button>Cancel</Button>
      <Button type="submit" variant="primary">
        Save
      </Button>
    </form>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(submits).toBe(0)
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(submits).toBe(1)
})
