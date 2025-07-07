import { CredentialsSignin } from "next-auth"

export class InvalidLoginError extends CredentialsSignin {
  code = "custom"
  
  constructor(message: string) {
    super(message)
    this.code = message
  }
}