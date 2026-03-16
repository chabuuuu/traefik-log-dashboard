{{/*
Common labels
*/}}
{{- define "traefik-log-dashboard.labels" -}}
app.kubernetes.io/part-of: traefik-log-dashboard
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
{{- end }}

{{/*
Agent labels
*/}}
{{- define "traefik-log-dashboard.agent.labels" -}}
{{ include "traefik-log-dashboard.labels" . }}
app.kubernetes.io/name: agent
app.kubernetes.io/component: backend
{{- end }}

{{/*
Agent selector labels
*/}}
{{- define "traefik-log-dashboard.agent.selectorLabels" -}}
app.kubernetes.io/name: agent
{{- end }}

{{/*
Dashboard labels
*/}}
{{- define "traefik-log-dashboard.dashboard.labels" -}}
{{ include "traefik-log-dashboard.labels" . }}
app.kubernetes.io/name: dashboard
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Dashboard selector labels
*/}}
{{- define "traefik-log-dashboard.dashboard.selectorLabels" -}}
app.kubernetes.io/name: dashboard
{{- end }}
