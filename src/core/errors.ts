export class CliError extends Error {
  constructor(
    message: string,
    public exitCode: number,
    public fix?: string,
  ) {
    super(message);
    this.name = "CliError";
  }
}
