import { auth } from "@/auth"

export default auth(() => {
  // Add any middleware logic here if needed
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}