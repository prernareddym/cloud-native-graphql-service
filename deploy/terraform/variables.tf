variable "aws_region" {
  description = "AWS region to create resources in"
  type        = string
  default     = "us-west-2"
}

variable "service_name" {
  description = "Name used for the ECR repository and log group"
  type        = string
  default     = "bookshelf-graphql"
}

variable "keep_last_images" {
  description = "Number of most recent images ECR keeps before expiring older ones"
  type        = number
  default     = 10

  validation {
    condition     = var.keep_last_images >= 1
    error_message = "keep_last_images must be at least 1."
  }
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}

variable "tags" {
  description = "Extra tags applied to all resources"
  type        = map(string)
  default     = {}
}
