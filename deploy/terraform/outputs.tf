output "ecr_repository_url" {
  description = "Push the Docker image here, then reference it in deploy/k8s/deployment.yaml"
  value       = aws_ecr_repository.service.repository_url
}

output "log_group_name" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.service.name
}
