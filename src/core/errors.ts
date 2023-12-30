class BaseError extends Error {
  constructor({ message }: { message: string }) {
    super(message);
    this.message = message;
  }
}

export class InvalidInputError extends BaseError {}

export class ResourceNotFoundError extends BaseError {}

export class UnauthenticatedError extends BaseError {}

export class UnexpectedError extends BaseError {}
