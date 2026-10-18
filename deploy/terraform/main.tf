provider "aws" {
  region = var.aws_region

  default_tags {
    tags = merge({ Project = var.service_name, ManagedBy = "terraform" }, var.tags)
  }
}

# Container registry for the service image
resource "aws_ecr_repository" "service" {
  name                 = var.service_name
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

# Keep storage small: expire everything except the newest N images
resource "aws_ecr_lifecycle_policy" "service" {
  repository = aws_ecr_repository.service.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last ${var.keep_last_images} images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = var.keep_last_images
      }
      action = { type = "expire" }
    }]
  })
}

# Log group the workload can ship container logs to
resource "aws_cloudwatch_log_group" "service" {
  name              = "/apps/${var.service_name}"
  retention_in_days = var.log_retention_days
}
