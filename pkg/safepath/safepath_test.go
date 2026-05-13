package safepath

import (
	"testing"
)

func TestSafeJoin(t *testing.T) {
	tests := []struct {
		name      string
		root      string
		untrusted string
		want      string
		wantErr   bool
	}{
		{
			name:      "simple filename",
			root:      "/home/user/.totem",
			untrusted: "bean-abc.md",
			want:      "/home/user/.totem/bean-abc.md",
		},
		{
			name:      "subdirectory path",
			root:      "/home/user/.totem",
			untrusted: "archive/bean-abc.md",
			want:      "/home/user/.totem/archive/bean-abc.md",
		},
		{
			name:      "path traversal with ..",
			root:      "/home/user/.totem",
			untrusted: "../../../etc/passwd",
			wantErr:   true,
		},
		{
			name:      "path traversal with embedded ..",
			root:      "/home/user/.totem",
			untrusted: "archive/../../etc/passwd",
			wantErr:   true,
		},
		{
			name:      "dot-dot escaping root",
			root:      "/home/user/.totem",
			untrusted: "..",
			wantErr:   true,
		},
		{
			name:      "absolute path ignores root",
			root:      "/home/user/.totem",
			untrusted: "/etc/passwd",
			wantErr:   true,
		},
		{
			name:      "current directory",
			root:      "/home/user/.totem",
			untrusted: ".",
			want:      "/home/user/.totem",
		},
		{
			name:      "nested safe path",
			root:      "/home/user/.totem",
			untrusted: ".conversations/bean-abc.jsonl",
			want:      "/home/user/.totem/.conversations/bean-abc.jsonl",
		},
		{
			name:      "trailing slash on root",
			root:      "/home/user/.totem/",
			untrusted: "file.md",
			want:      "/home/user/.totem/file.md",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := SafeJoin(tt.root, tt.untrusted)
			if tt.wantErr {
				if err == nil {
					t.Errorf("SafeJoin(%q, %q) = %q, want error", tt.root, tt.untrusted, got)
				}
				return
			}
			if err != nil {
				t.Errorf("SafeJoin(%q, %q) unexpected error: %v", tt.root, tt.untrusted, err)
				return
			}
			if got != tt.want {
				t.Errorf("SafeJoin(%q, %q) = %q, want %q", tt.root, tt.untrusted, got, tt.want)
			}
		})
	}
}

func TestValidateBeanID(t *testing.T) {
	tests := []struct {
		name    string
		beanID  string
		wantErr bool
	}{
		{name: "valid simple", beanID: "bean-abc1", wantErr: false},
		{name: "valid with underscores", beanID: "__central__", wantErr: false},
		{name: "valid alphanumeric", beanID: "abc123", wantErr: false},
		{name: "valid with hyphens", beanID: "my-bean-id", wantErr: false},
		{name: "empty", beanID: "", wantErr: true},
		{name: "path traversal", beanID: "../../../etc/passwd", wantErr: true},
		{name: "contains slash", beanID: "bean/evil", wantErr: true},
		{name: "contains backslash", beanID: "bean\\evil", wantErr: true},
		{name: "contains dot-dot", beanID: "bean..evil", wantErr: true},
		{name: "contains space", beanID: "bean evil", wantErr: true},
		{name: "contains null byte", beanID: "bean\x00evil", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateBeanID(tt.beanID)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateBeanID(%q) error = %v, wantErr %v", tt.beanID, err, tt.wantErr)
			}
		})
	}
}
