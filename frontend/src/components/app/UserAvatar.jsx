import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { assetUrl, initialsOf } from '../../lib/utils'

/**
 * One avatar for every place an account appears: the sidebar, a member roster,
 * a triage note. A picture that fails to load falls back to the monogram, which
 * is what the primitive does when there is no source at all.
 */
export function UserAvatar({ person, className }) {
  const src = assetUrl(person?.avatar_url)
  return (
    <Avatar className={className}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className="font-semibold text-foreground">{initialsOf(person)}</AvatarFallback>
    </Avatar>
  )
}
